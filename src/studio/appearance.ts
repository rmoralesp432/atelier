export type RenderMode = 'studio' | 'wireframe' | 'hidden-line';
export type Appearance = {
  mode: RenderMode;
  lineColor: string;
  surfaceColor: string;
};
export const defaultAppearance: Appearance = {
  mode: 'studio',
  lineColor: '#d9e4e4',
  surfaceColor: '#22282c',
};
export const palette = [
  '#e2e7e6',
  '#8acbc5',
  '#9eadd8',
  '#d58b69',
  '#d9c28c',
  '#bd9cbd',
  '#657782',
  '#eb7770',
];
export function loadAppearance(): Appearance {
  try {
    const a = JSON.parse(localStorage.getItem('atelier.appearance') ?? 'null');
    if (
      a &&
      ['studio', 'wireframe', 'hidden-line'].includes(a.mode) &&
      /^#[0-9a-f]{6}$/i.test(a.lineColor) &&
      /^#[0-9a-f]{6}$/i.test(a.surfaceColor)
    )
      return a;
  } catch {
    /* Use the studio default if preferences are unavailable. */
  }
  return defaultAppearance;
}
