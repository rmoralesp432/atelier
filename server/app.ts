import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { parsePlan } from '../src/intelligence/plan';
import { requestSchema, type Provider } from './provider';
export function createApi(
  provider: Provider | null,
  options: { password?: string; production?: boolean; origin?: string } = {},
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  const sessions = new Map<string, number>();
  const rate = new Map<string, { time: number; count: number }>();
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.get('origin');
    const allowed = options.origin || `${req.protocol}://${req.get('host')}`;
    if (origin && origin !== allowed) {
      res.status(403).json({
        error: 'This request must come from the ATELIER application origin.',
      });
      return;
    }
    const now = Date.now();
    for (const [key, s] of rate) if (now - s.time > 60_000) rate.delete(key);
    for (const [key, expiry] of sessions)
      if (now > expiry) sessions.delete(key);
    const key = req.ip || 'local';
    const state = rate.get(key) || { time: now, count: 0 };
    if (++state.count > 60) {
      res
        .status(429)
        .json({ error: 'Too many requests. Please wait a minute.' });
      return;
    }
    rate.set(key, state);
    next();
  });
  const authenticated = (cookie: string | undefined) =>
    !options.password ||
    (sessions.get(
      cookie
        ?.split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('atelier_session='))
        ?.slice(16) || '',
    ) || 0) > Date.now();
  app.get('/api/config', (req, res) =>
    res.json({
      configured: Boolean(provider),
      authenticated: authenticated(req.headers.cookie),
      voiceConfigured: Boolean(provider),
    }),
  );
  app.post('/api/login', (req, res) => {
    const candidate =
      typeof req.body?.password === 'string' ? req.body.password : '';
    const expected = options.password || '';
    const ok =
      candidate.length <= 200 &&
      Buffer.byteLength(candidate) === Buffer.byteLength(expected) &&
      timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
    if (!ok) {
      res.status(401).json({ error: 'Incorrect workspace password.' });
      return;
    }
    const token = randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + 8 * 3600_000);
    res.setHeader(
      'Set-Cookie',
      `atelier_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800${options.production ? '; Secure' : ''}`,
    );
    res.json({ ok: true });
  });
  app.use('/api', (req, res, next) => {
    if (!authenticated(req.headers.cookie)) {
      res.status(401).json({ error: 'Unlock this workspace to use AI.' });
      return;
    }
    if (!provider) {
      res.status(503).json({
        error:
          'AI is not configured. Add ATELIER_OPENAI_API_KEY securely on the server. Geometry tools remain available.',
      });
      return;
    }
    next();
  });
  app.post('/api/plan', async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid or oversized modeling context.' });
      return;
    }
    try {
      res.json(parsePlan(await provider!.plan(parsed.data)));
    } catch {
      res.status(502).json({
        error:
          'The model service could not produce a valid plan. No geometry was changed. Check provider access and try again.',
      });
    }
  });
  app.post('/api/voice', async (req, res) => {
    if (
      typeof req.body?.sdp !== 'string' ||
      req.body.sdp.length > 100_000 ||
      !req.body.sdp.startsWith('v=0')
    ) {
      res.status(400).json({ error: 'Invalid voice connection offer.' });
      return;
    }
    try {
      res.type('application/sdp').send(await provider!.voice(req.body.sdp));
    } catch {
      res.status(502).json({
        error: 'The realtime voice service could not establish a connection.',
      });
    }
  });
  app.use('/api', (_req, res) =>
    res.status(404).json({ error: 'Unknown API endpoint.' }),
  );
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(400).json({ error: 'Invalid request body.' });
    },
  );
  return app;
}
