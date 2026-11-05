# FBX regression fixtures

The unmodified binary fixtures come from [ufbx/ufbx](https://github.com/ufbx/ufbx), pinned to commit `1d097696e33b367bb3152b175aeb2d95193f9b6e`:

- `revit-wall.fbx`: `data/revit_wall_square_7700_binary.fbx` (88,128 bytes). Revit-exported wall assembly, FBX 7.7, Z-up, unit scale 30.48 cm (feet). Includes four wall mesh nodes and two level-annotation meshes.
- `maya-cube.fbx`: `data/maya_cube_7400_binary.fbx` (20,144 bytes). FBX 7.4 binary cube with centimeter metadata.

Used under the upstream MIT option. Copyright (c) 2020 Samuli Raivio. The complete upstream dual-license notice is retained in `LICENSE.ufbx`.

`assembly.ts` is an authored minimal ASCII FBX 7.4 fixture for ATELIER: two instances, a rotated/translated parent, a mirrored and raised second instance, distinct diffuse colors, and a deliberately unreachable texture URL. This checks importer behavior without paid services, uploaded user models, or a Revit installation.
