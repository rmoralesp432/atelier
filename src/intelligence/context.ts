import type { Project, Vec3 } from '../model';
export type CameraContext = {
  right: Vec3;
  forward: Vec3;
  visible: { id: string; x: number; y: number }[];
};
export type ConversationContext = {
  focusIds: string[];
  lastCreatedIds: string[];
  lastOperands: string[];
  lastOperation: string | null;
};
export const emptyContext = (): ConversationContext => ({
  focusIds: [],
  lastCreatedIds: [],
  lastOperands: [],
  lastOperation: null,
});
export const defaultCamera: CameraContext = {
  right: { x: 1, y: 0, z: 0 },
  forward: { x: 0, y: 0, z: -1 },
  visible: [],
};
export function directionVector(
  direction: string,
  camera: CameraContext,
): Vec3 {
  const sign = ['left', 'back', 'south', 'west', 'down'].includes(direction)
    ? -1
    : 1;
  const v = ['left', 'right'].includes(direction)
    ? camera.right
    : ['forward', 'back'].includes(direction)
      ? camera.forward
      : ['north', 'south'].includes(direction)
        ? { x: 0, y: 0, z: -1 }
        : ['east', 'west'].includes(direction)
          ? { x: 1, y: 0, z: 0 }
          : { x: 0, y: 1, z: 0 };
  const length = Math.hypot(v.x, v.y, v.z);
  if (!Number.isFinite(length) || length < 0.001)
    throw new Error('The camera direction is unavailable.');
  return {
    x: (sign * v.x) / length,
    y: (sign * v.y) / length,
    z: (sign * v.z) / length,
  };
}
export function sceneContext(
  project: Project,
  conversation: ConversationContext,
  camera: CameraContext,
) {
  return {
    units: 'meters' as const,
    north: '-Z' as const,
    selectedIds:
      project.selectedIds ?? (project.selectedId ? [project.selectedId] : []),
    conversation,
    camera,
    objects: project.volumes.map((v, index) => ({
      id: v.id,
      ordinal: index + 1,
      name: v.name,
      dimensions: v.dimensions,
      position: v.position,
      rotation: v.rotation,
      shape: v.geometry?.kind ?? 'box',
      opening: v.geometry?.kind === 'boolean' && v.geometry.opening === true,
    })),
  };
}
export const SYSTEM_PROMPT = `You are ATELIER, an architectural design assistant editing a real 3D workspace. Interpret flexible English or Spanish into the provided geometric operation schema. Never output code or claim a change was executed. The geometry engine validates and executes your plan afterward.
Use only object IDs in the provided current scene. References $selected, $focus, $created, $operands are supported by the engine; do not invent IDs. $created refers to the last creation/duplication in this plan or previous turn. Ordinals use scene order. Selected objects take priority for "this/it"; otherwise conversation focus. "These/them" uses the focus group or multi-selection. Visible objects have projected x/y: larger x is farther right on screen. Ask a precise clarification when descriptions match multiple objects, the subtraction order is unclear, or the target of an important change cannot be resolved. A clarification has no operations.
Directions left/right/forward/back are camera-relative on the ground plane. North is project -Z, east +X, up +Y. Never substitute world X for camera-relative movement. Approximate moves use distance:null (10% of maximum object size, at least 0.25m); approximate resizing uses mode:scale,value:1.1 (or 0.9 for smaller). "A little more to the left" is another relative left move. "20 meters long" means width 20; use sensible defaults depth 8 height 6 and state them. Create two boxes uses count:2; count for duplicate means number of NEW copies. Unknown create dimensions default to width12 depth8 height6. Round primitives default to equal width and depth; spheres also default height to width unless the user requests an ellipsoid. Shapes rectangle/circle are 2D on the ground; extrude creates a solid. Align means base centers on the given world axis; clarify if axis is unspecified. Place next_to uses bounding extents and gap, overlap uses half overlap.
A boolean uses exactly two distinct objects; targets[0] is the retained base, targets[1] is the cutter for subtraction. Never guess subtraction order from a bare "this from that" without distinct selection/recent operand context. Destructive operations present a review before execution; use the message to identify operands. Original operands are preserved in the result recipe. "Undo that and intersect them instead" should emit undo first, then intersect on $operands (the previous boolean operands). Do not lose that pair after undo. A result can be resized by its stable object ID. An opening cuts all the way through local Z of the wall, centered at local X offset and base elevation sill. If which wall face or location is unclear, clarify. edit_opening changes the most recent opening's width/height; other parameters remain. Do not claim arbitrary polygons, terrain, BIM, PDFs or features absent from the schema. Ask or explain the supported scope. No keyword grammar should be exposed to users.`;
