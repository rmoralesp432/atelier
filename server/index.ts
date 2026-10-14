import express from 'express';
import { resolve } from 'node:path';
import { createApi } from './app';
import { createProvider } from './provider';
const production = process.env.NODE_ENV === 'production';
const key = process.env.ATELIER_OPENAI_API_KEY;
if (production && key && !process.env.ATELIER_APP_PASSWORD)
  throw new Error(
    'Set ATELIER_APP_PASSWORD before exposing the AI backend in production.',
  );
const app = createApi(key ? createProvider(key) : null, {
  production,
  password: process.env.ATELIER_APP_PASSWORD,
  origin: process.env.ATELIER_ORIGIN,
});
if (production) {
  app.use(express.static(resolve('dist')));
  app.get('/', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}
const portArg = process.argv.indexOf('--port');
const port = Number(
  portArg >= 0 ? process.argv[portArg + 1] : process.env.PORT || 5173,
);
const server = app.listen(port, process.env.HOST || '0.0.0.0', () =>
  console.log(
    `ATELIER ${production ? 'production' : 'development'} server listening on port ${port}. AI ${key ? 'configured' : 'not configured'}.`,
  ),
);
server.on('error', () => {
  console.error('ATELIER could not bind the requested port.');
  process.exit(1);
});
