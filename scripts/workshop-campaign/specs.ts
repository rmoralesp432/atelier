export type Spec = {
  id: string;
  domain: string;
  create: string;
  edit?: string;
  mode?: 'seeded' | 'negative';
};
export const workshop: Spec[] = [
  {
    id: 'W1',
    domain: 'furniture',
    create:
      'Create a small contemporary console with four separately editable parts: a top, two upright slab-like side supports and one low back stretcher connecting the supports. The top is 1.9 m long along X, 58 cm deep and 45 mm thick, with its upper surface 84 cm above the ground. Center it at the origin in plan. Let it overhang the outside faces of both supports by 10 cm. Use reasonable support and stretcher sections; keep the stretcher low enough to leave a clear open space below the top. Group the console and leave the existing samples untouched.',
    edit: 'Make the console 42 cm wider symmetrically, keeping it centered. Retain its existing end overhangs, support thicknesses, depth and height. Adjust the back stretcher so it still connects the supports. Keep the existing components and leave the other objects alone.',
  },
  {
    id: 'W2',
    domain: 'architecture',
    create:
      'Model a simple garden room centered at the origin, 3.6 m along X by 2.8 m along Z. Give it a separate 12 cm floor slab resting on the ground, a flat 15 cm roof whose underside is 2.6 m above the floor surface, four slender corner posts, full-height glazing along the two side façades, and a solid back wall; leave the front open. Use one editable object for each slab, post, side glazing panel and back wall, organized as one assembly. Use reasonable posts and wall thicknesses and keep all of them within the footprint. Leave the existing samples alone.',
    edit: 'Raise the floor surface by 38 cm, keeping the slab thickness, the roof and the outer footprint unchanged. Shorten the posts, side glazing and back wall to follow the raised floor while retaining their connections to the roof. Keep all the existing components and preserve the other objects.',
  },
  {
    id: 'W3',
    domain: 'mechanical',
    create:
      'Build an editable roller assembly centered at the origin in plan, with its horizontal axis along X at 80 cm above ground. The hollow roller is 1 m long, 50 cm outside diameter, with a 14 cm through-bore. A 10 cm diameter shaft, 1.8 m long and centered on the roller, passes through it. Put a separate upright bearing block beyond each roller end, leaving an 8 cm clear gap. Each block is 12 cm thick along X, 42 cm across Z and 1 m tall, with a coaxial 14 cm through-hole. Stand both blocks on a separate 1.8 by 0.7 m base plate, 12 cm thick, on the ground. Keep those five parts independently editable and grouped; preserve the existing samples.',
    edit: 'Make the roller 40 cm longer without moving its center. Let the bearing blocks follow its ends while preserving their existing air gaps. Adjust the shaft and base so their current end overhangs and the bearings’ setbacks from the base ends stay the same. Keep bore diameters, transverse sizes and existing component identities, and leave the other objects alone.',
  },
  {
    id: 'W4',
    domain: 'sculptural',
    create:
      'Create a freestanding elliptical halo sculpture in the vertical XY plane, centered on X=0 and Z=0. Its outer ellipse is 1.5 m wide and 2 m tall; the concentric opening is 1.24 m wide and 1.74 m tall. Make it 12 cm deep through Z, with its lowest point 30 cm above ground. Carry it on two slender vertical round supports, 64 cm apart symmetrically, rising from a separate 1.8 by 0.45 m plinth that is 18 cm high. Let the supports meet the lower rim rather than fill the opening. Keep the halo, both supports and plinth as four editable components. Leave the existing samples untouched.',
    edit: 'Raise the halo by 28 cm. Keep the plinth and the feet of the two supports where they are, extending the supports to meet the rim. Preserve the halo’s exact curved shape and opening, its depth and the supports’ diameters. Keep the existing parts and leave the other objects alone.',
  },
];
export const verifier: Spec[] = [
  {
    id: 'D-H1',
    domain: 'verifier',
    create:
      'Create six separate upright cylindrical samples, each 14 cm in diameter and 48 cm tall. In plan, their centers follow a 120-degree circular arc of radius 1.7 m around X = -0.9 m, Z = 1.3 m. The first center is at 37 degrees from +X toward +Z; proceed toward decreasing angles, including both ends of the arc, with equal angular spacing. The first base is at 0.6 m and each successive base is 11 cm higher. Keep every sample independently editable and preserve the existing reference objects.',
  },
  {
    id: 'D-H2',
    domain: 'verifier',
    mode: 'seeded',
    create:
      'Move the three pieces in “Display pieces” into the mirror image of their current plan arrangement across the line passing through X = 1.1 m, Z = -0.8 m at 34 degrees from +X toward +Z. Reflect their positions only: keep each piece’s height above ground, size, shape and facing direction unchanged. Move the existing pieces rather than duplicating them, and leave the reference objects untouched.',
  },
];
verifier.push({ ...verifier[0], id: 'D-N1', mode: 'negative' });
export const specs = [...workshop, ...verifier];
