import express from 'express';
import { resolve } from 'node:path';
import { accessSync } from 'node:fs';
import { createApi } from './app';
import { createProvider } from './provider';
import { serverConfig } from './config';
const { production, key, password, origin } = serverConfig(process.env);
// Fail startup before reporting health when the browser build is absent.
if (production) accessSync(resolve('dist/index.html'));
const app = createApi(key ? createProvider(key) : null, {
  production,
  password,
  origin,
});
if (production) {
  app.use(
    express.static(resolve('dist'), {
      setHeaders(res, path) {
        res.setHeader(
          'Cache-Control',
          path.endsWith('.html')
            ? 'no-store'
            : path.includes('/assets/')
              ? 'public, max-age=31536000, immutable'
              : 'no-cache',
        );
      },
    }),
  );
  // Do not cache missing old chunks or return HTML as a JavaScript module.
  app.use('/assets', (_req, res) =>
    res
      .status(404)
      .set('Cache-Control', 'no-store')
      .type('text/plain')
      .send(
        'This application asset is unavailable. Refresh to load the current version.',
      ),
  );
  app.get('/', (_req, res) =>
    res.set('Cache-Control', 'no-store').sendFile(resolve('dist/index.html')),
  );
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
