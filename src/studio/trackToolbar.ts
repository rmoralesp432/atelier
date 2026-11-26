/** Keep viewport hints below the actual wrapped toolbar, including phone layouts. */
export function trackToolbar(node: HTMLDivElement | null) {
  const stage = node?.closest<HTMLElement>('.viewport-stage');
  if (!node || !stage) return;
  const update = () => {
    stage.style.setProperty(
      '--selection-tools-bottom',
      `${node.offsetTop + node.offsetHeight + 12}px`,
    );
  };
  const observer = new ResizeObserver(update);
  observer.observe(node);
  window.addEventListener('resize', update);
  update();
  return () => {
    observer.disconnect();
    window.removeEventListener('resize', update);
    stage.style.removeProperty('--selection-tools-bottom');
  };
}
