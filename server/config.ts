// Use a trusted hosting environment value, never forwarded request headers,
// to recognize the public HTTPS origin behind a terminating proxy.
export function serverConfig(env: NodeJS.ProcessEnv) {
  const production = env.NODE_ENV === 'production';
  const key = env.ATELIER_OPENAI_API_KEY;
  const password = env.ATELIER_APP_PASSWORD;
  if (production && key && !password)
    throw new Error(
      'Set ATELIER_APP_PASSWORD before exposing the AI backend in production.',
    );
  const externalUrl = env.ATELIER_ORIGIN || env.RENDER_EXTERNAL_URL;
  let origin: string | undefined;
  if (externalUrl) {
    const url = new URL(externalUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      (production && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error(
        'The public ATELIER origin must be an HTTPS origin without a path or credentials.',
      );
    origin = url.origin;
  }
  return { production, key, password, origin };
}
