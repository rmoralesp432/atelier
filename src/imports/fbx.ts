import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// FBXLoader consults the manager for every texture extension. Never request
// local paths, remote URLs or decode embedded images from an imported model.
class GeometryOnlyTextureLoader extends THREE.Loader<THREE.Texture> {
  override load(url: string) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    return new THREE.Texture();
  }
}
export function readFbx(bytes: ArrayBuffer) {
  const manager = new THREE.LoadingManager();
  manager.addHandler(/.*/, new GeometryOnlyTextureLoader(manager));
  manager.setURLModifier(() => {
    throw new Error('External FBX resources are disabled.');
  });
  try {
    return new FBXLoader(manager).parse(bytes, '');
  } catch {
    throw new Error(
      'This FBX could not be read. Export a static 3D view as FBX 7.x (2011 or newer) and try again.',
    );
  }
}
