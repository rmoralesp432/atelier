import * as THREE from 'three';
/** Analytic world-space grid. Camera-sized coverage, anti-aliased lines, soft horizon. */
export function spatialGrid() {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
    uniforms: {
      ink: { value: new THREE.Color('#8d9e98') },
      strength: { value: 0.11 },
      spacing: { value: 1 },
      reach: { value: 250 },
      clipFade: { value: 3500 },
    },
    vertexShader: `varying vec3 world;
      void main(){vec4 p=modelMatrix*vec4(position,1.0);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader: `varying vec3 world; uniform vec3 ink; uniform float strength; uniform float spacing; uniform float reach; uniform float clipFade;
      float line(vec2 p){vec2 w=max(fwidth(p),vec2(0.0001));vec2 d=abs(fract(p-0.5)-0.5)/w;vec2 fade=1.0-smoothstep(vec2(0.15),vec2(1.5),w);return max((1.0-min(d.x,1.0))*fade.x,(1.0-min(d.y,1.0))*fade.y);}
      void main(){float nearLines=line(world.xz/spacing);float majorLines=line(world.xz/(spacing*10.0));
        float distanceFade=1.0-smoothstep(reach*0.3,reach,length(world.xz-cameraPosition.xz));
        float clip=1.0-smoothstep(clipFade*0.65,clipFade,length(world-cameraPosition));
        float opacity=max(nearLines*0.25,majorLines)*strength*distanceFade*clip;
        gl_FragColor=vec4(ink,opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.02;
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return {
    mesh,
    theme(day: boolean) {
      material.uniforms.ink.value.set(day ? '#52625b' : '#a6b7ae');
      material.uniforms.strength.value = day ? 0.16 : 0.11;
    },
    update(
      camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
      target: THREE.Vector3,
    ) {
      const visibleSpan =
        camera instanceof THREE.OrthographicCamera
          ? (camera.top - camera.bottom) / camera.zoom
          : camera.position.distanceTo(target);
      const spacing = Math.pow(
        10,
        Math.max(0, Math.floor(Math.log10(Math.max(visibleSpan, 1) / 15))),
      );
      material.uniforms.spacing.value = spacing;
      material.uniforms.reach.value = Math.max(40, visibleSpan * 3);
      material.uniforms.clipFade.value = camera.far * 0.85;
      mesh.position.x = camera.position.x;
      mesh.position.z = camera.position.z;
      mesh.scale.setScalar(camera.far * 4);
      return spacing;
    },
  };
}
