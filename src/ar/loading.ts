/** Safari, Chromium, Firefox and Vite's CSS preloader use different wording. */
export function isModuleLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|unable to preload css|loading chunk .+ failed/i.test(
      error.message,
    )
  );
}
