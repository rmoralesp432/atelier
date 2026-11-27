/** External evaluation only: separate bounded placement from occupied shape. */
import { sameSolid, stats } from '../phase3-evaluation/geometry';
export function placedSolid(a: any, b: any, relative = 0.02, linear = 0.002) {
  const x = stats(a),
    y = stats(b);
  if (
    Math.hypot(...x.center.map((v: number, i: number) => v - y.center[i])) >
      linear ||
    x.size.some((v: number, i: number) => Math.abs(v - y.size[i]) > linear)
  )
    return false;
  // Keep orientation and scale: only remove a placement discrepancy already
  // bounded above. A thin object must not receive a tighter positional
  // tolerance merely because its surface-to-volume ratio is large.
  const aligned = a.translate(
    x.center.map((v: number, i: number) => y.center[i] - v),
  );
  try {
    return sameSolid(aligned, b, relative, linear);
  } finally {
    aligned.delete();
  }
}
