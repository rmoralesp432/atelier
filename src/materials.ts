/** Rendering categories are not physical material specifications. */
export const renderMaterials = ['solid', 'glass', 'frame'] as const;
export const materialContract =
  'material is a rendering category: solid, glass or frame. materialSpec is an explicit material designation stored on the object, e.g. a wood species or alloy. Assign it with material.specification. Names and colors never establish materialSpec. A verified designation is model metadata, not a laboratory, structural, fire-rating or physical-composition certification; those requirements remain unverified.';
