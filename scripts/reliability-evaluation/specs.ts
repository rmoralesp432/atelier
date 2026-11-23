/** Fresh tasks defined after implementation 16361bb was frozen. Never imported by the app. */
export type Spec = {
  id: string;
  domain: string;
  create: string;
  edit?: string;
  edit2?: string;
  mode?: 'seeded' | 'negative';
};
export const specs: Spec[] = [
  {
    id: 'L1',
    domain: 'furniture',
    create:
      'Make a freestanding library shelf, centered in plan, 4.9 m wide along X, 40 cm deep and 1.85 m high. Give it six equally wide clear bays between seven vertical panels, each 40 mm thick. Each bay has four separate 35 mm thick shelves with their upper surfaces 25, 70, 115 and 160 cm above the floor, fitted between the upright panels. Use 31 independently editable parts in one assembly, without a back panel. Keep the existing samples untouched.',
    edit: 'Make this shelving 90 cm wider symmetrically. Keep the upright thicknesses, depth, height and shelf elevations as they are. Keep all six bays equally wide and the shelves fitted to them. Change the existing pieces, and leave the other objects alone.',
    edit2:
      'Raise only the second shelf from the bottom in each bay by 12 cm. Keep every other part exactly as it is.',
  },
  {
    id: 'L2',
    domain: 'mechanical',
    create:
      'Build a simple roller conveyor as separate editable solids, centered at the origin. There are 24 horizontal cylindrical rollers running across Z, each 90 cm long and 16 cm in diameter. Their axes are 85 cm above the ground, equally spaced at 20 cm along X and symmetric about the origin. Two side rails run along X, each 5.2 m long, 14 cm wide and 20 cm tall, with tops level with the roller axes. Place the rails so their inner faces meet the roller ends. Support each rail on four 8 cm square legs at X=-2.4, -0.8, 0.8 and 2.4 m, from the ground to the rail underside. Keep the 34 parts independently editable in an assembly; omit fine hardware and preserve the other objects.',
    edit: 'Widen the conveyor by 30 cm while keeping its centerline. Preserve the existing relationship between the roller ends and the rails, and let the legs follow their rails. Keep roller diameters, pitch and height unchanged. Keep the same parts and leave the samples alone.',
    edit2:
      'Raise the entire roller bed by 20 cm while keeping the feet on the ground. Keep its plan outline and all cross sections unchanged, extending the existing legs as needed. Preserve the same components and unrelated work.',
  },
  {
    id: 'L3',
    domain: 'architecture',
    create:
      'Create a small screened canopy centered at the origin. Its ground platform is 6 by 3.2 m and 18 cm thick. Above it put a separate flat 5.8 by 3 m roof, 16 cm thick, with its underside 2.7 m above ground. Support the roof on two rows of five circular 12 cm diameter columns, at Z=-1.2 and +1.2 m; within each row the column centers run from X=-2.6 to +2.6 m at equal spacing. Add a rear privacy screen of 21 separate vertical rectangular fins, 8 cm along X and 18 cm along Z, centered at Z=-1.35 m and equally spaced from X=-2.6 to +2.6 m. Columns and fins extend from the platform surface to the roof underside. Keep all 33 parts independently editable and grouped. Leave the existing samples alone.',
    edit: 'Lower the canopy roof by 35 cm, keeping the ground platform exactly as it is. Keep the supports and privacy screen connected to the underside of the roof, with their lower ends in place. Preserve all cross sections, plan positions and existing parts.',
    edit2:
      'Rotate the whole canopy assembly in plan by 20 degrees, about its center, with its long direction turning from +X toward +Z. Keep all its internal relationships and the same components. Leave the other objects untouched.',
  },
];
