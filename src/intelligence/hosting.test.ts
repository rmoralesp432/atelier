import { expect, it } from 'vitest';
import { serverConfig } from '../../server/config';
import { createApi } from '../../server/app';

it('uses the Render HTTPS origin and gives a custom domain precedence', () => {
  const env = {
    NODE_ENV: 'production',
    RENDER_EXTERNAL_URL: 'https://atelier-test.onrender.com/',
  };
  expect(serverConfig(env).origin).toBe('https://atelier-test.onrender.com');
  expect(
    serverConfig({ ...env, ATELIER_ORIGIN: 'https://design.example' }).origin,
  ).toBe('https://design.example');
  expect(() =>
    serverConfig({ ...env, ATELIER_ORIGIN: 'http://design.example' }),
  ).toThrow();
  expect(() =>
    serverConfig({ ...env, ATELIER_ORIGIN: 'https://design.example/path' }),
  ).toThrow();
  expect(() =>
    serverConfig({
      NODE_ENV: 'production',
      ATELIER_OPENAI_API_KEY: 'test-only',
    }),
  ).toThrow(/PASSWORD/);
});

it('serves health without authentication and accepts secure browser login behind an HTTP proxy', async () => {
  let voiceCalls = 0;
  const origin = 'https://atelier-test.onrender.com';
  const options = serverConfig({
    NODE_ENV: 'production',
    RENDER_EXTERNAL_URL: origin,
    ATELIER_APP_PASSWORD: 'test-only-password',
  });
  const server = createApi(
    {
      plan: async () => ({
        intent: 'clarify',
        message: 'Which building?',
        operations: [],
      }),
      voice: async (sdp) => {
        voiceCalls++;
        expect(sdp).toBe('v=0\r\n');
        return 'v=0\r\nanswer';
      },
    },
    options,
  ).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const post = (path: string, body: unknown, extra = {}) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin, ...extra },
      body: JSON.stringify(body),
    });
  try {
    expect(await (await fetch(base + '/healthz')).json()).toEqual({
      status: 'ok',
    });
    expect((await post('/api/voice', { sdp: 'v=0\r\n' })).status).toBe(401);
    expect((await post('/api/login', { password: 'wrong' })).status).toBe(401);
    expect(
      (
        await post(
          '/api/login',
          { password: 'test-only-password' },
          {
            Origin: 'https://foreign.example',
            'X-Forwarded-Host': 'atelier-test.onrender.com',
            'X-Forwarded-Proto': 'https',
          },
        )
      ).status,
    ).toBe(403);
    const login = await post('/api/login', { password: 'test-only-password' });
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie')!;
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    const headers = { Cookie: cookie.split(';')[0] };
    const answer = await post('/api/voice', { sdp: 'v=0\r\n' }, headers);
    expect(answer.status).toBe(200);
    expect(await answer.text()).toBe('v=0\r\nanswer');
    expect(voiceCalls).toBe(1);
    const config = await (
      await fetch(base + '/api/config', { headers })
    ).json();
    expect(config).toEqual({
      configured: true,
      authenticated: true,
      voiceConfigured: true,
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
