import type { Project } from '../model';
import { groupBounds } from '../geometry/spatial';
export type SectionView = {
  enabled: boolean;
  planeVisible?: boolean;
  axis: 'x' | 'y' | 'z';
  position: number;
  flip: boolean;
};
export const defaultSection: SectionView = {
  enabled: false,
  planeVisible: false,
  axis: 'y',
  position: 3,
  flip: false,
};
export function sectionRange(project: Project, axis: SectionView['axis']) {
  if (!project.volumes.length) return { min: 0, max: 10 };
  const b = groupBounds(project.volumes);
  return { min: b.min[axis], max: b.max[axis] };
}
