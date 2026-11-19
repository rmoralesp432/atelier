import type { WalkPlacement } from './walkPlacement';
export type CameraSettings = {
  fov: number;
  walk: boolean;
  eyeHeight: number;
  level: number;
  blur: number;
  focus: number;
  placement?: WalkPlacement & { revision: number };
};
export const defaultCameraSettings: CameraSettings = {
  fov: 40,
  walk: false,
  eyeHeight: 1.65,
  level: 0,
  blur: 0,
  focus: 20,
};
