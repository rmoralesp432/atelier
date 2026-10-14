import { it, expect } from 'vitest';
import { createApi } from '../../server/app';
import type { Provider } from '../../server/provider';
import { initialProject } from '../model';
import { sceneContext, emptyContext, defaultCamera } from './context';
async function serve(
  provider: Provider | null,
  fn: (url: string) => Promise<void>,
  options = {},
) {
  const server = createApi(provider, options).listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  try {
    await fn(`http://127.0.0.1:${(server.address() as { port: number }).port}`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}
const request = {
  message: 'Would you add two modest pavilions?',
  history: [],
  scene: sceneContext(initialProject(), emptyContext(), defaultCamera),
};
it('reports missing credentials honestly and never fabricates a plan', async () =>
  serve(null, async (url) => {
    expect((await (await fetch(url + '/api/config')).json()).configured).toBe(
      false,
    );
    expect(
      (
        await fetch(url + '/api/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
      ).status,
    ).toBe(503);
  }));
it('routes flexible text and full spatial context to the provider and validates the result', async () => {
  let received = '';
  await serve(
    {
      plan: async (input) => {
        received = input.message;
        return {
          intent: 'clarify',
          message: 'Which building?',
          operations: [],
        };
      },
      voice: async () => '',
    },
    async (url) => {
      const r = await fetch(url + '/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      expect(r.status).toBe(200);
      expect((await r.json()).intent).toBe('clarify');
      expect(received).toBe(request.message);
    },
  );
});
it('protects the paid API with an HttpOnly login and rejects foreign origins', async () =>
  serve(
    {
      plan: async () => ({
        intent: 'clarify',
        message: 'Which one?',
        operations: [],
      }),
      voice: async () => '',
    },
    async (url) => {
      expect((await fetch(url + '/api/plan', { method: 'POST' })).status).toBe(
        401,
      );
      expect(
        (
          await fetch(url + '/api/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Origin: 'https://untrusted.example',
            },
            body: JSON.stringify({ password: 'test-password' }),
          })
        ).status,
      ).toBe(403);
      const r = await fetch(url + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-password' }),
      });
      expect(r.status).toBe(200);
      const cookie = r.headers.get('set-cookie')!;
      expect(cookie).toContain('HttpOnly');
      expect(
        (
          await (
            await fetch(url + '/api/config', {
              headers: { Cookie: cookie.split(';')[0] },
            })
          ).json()
        ).authenticated,
      ).toBe(true);
    },
    { password: 'test-password' },
  ));
