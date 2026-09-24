import { LinearFilter, LinearMipmapLinearFilter, type Texture, type MeshBasicMaterial } from 'three';

export const configureCoverSampling = (texture: Texture, maxAnisotropy: number) => {
  // Preserve detail along the long axis of the strongly foreshortened covers.
  // Trilinear mipmaps still suppress shimmer along their compressed axis.
  texture.anisotropy = Math.max(1, Math.min(16, maxAnisotropy));
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
};

export const softenCoverEdges = (material: MeshBasicMaterial) => {
  // A one-fragment coverage ramp affects only the silhouette, never the image
  // interior. It also works when a browser declines requested default-framebuffer
  // MSAA. UVs rotate with the plane, so rectangle/diamond edges both stay smooth.
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec2 coverEdgeDistance = min(vMapUv, vec2(1.0) - vMapUv);
      vec2 coverEdgeWidth = max(fwidth(vMapUv), vec2(0.000001));
      vec2 coverCoverage = smoothstep(vec2(0.0), coverEdgeWidth, coverEdgeDistance);
      diffuseColor.a *= coverCoverage.x * coverCoverage.y;
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = () => 'annual-cover-edge-coverage-v1';
};
