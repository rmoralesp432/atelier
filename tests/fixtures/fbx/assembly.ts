// Small authored FBX 7.4 ASCII assembly: two instances of one mesh under a
// translated/rotated parent; the second instance is mirrored and raised.
// Texture deliberately points off-site so tests catch accidental image loads.
export function asciiAssembly(
  options: {
    texture?: boolean;
    unit?: number;
    up?: number;
    multiMaterial?: boolean;
  } = {},
) {
  const texture = options.texture !== false;
  return `; FBX 7.4.0 project file
FBXHeaderExtension:  {
\tFBXHeaderVersion: 1003
\tFBXVersion: 7400
}
GlobalSettings:  {
\tProperties70:  {
\t\tP: "UpAxis", "int", "Integer", "",${options.up ?? 1}
\t\tP: "UnitScaleFactor", "double", "Number", "",${options.unit ?? 100}
\t}
}
Objects:  {
\tGeometry: 1, "Geometry::Box", "Mesh" {
\t\tVertices: *24 {
\t\t\ta: -1,-1.5,2,1,-1.5,2,-1,1.5,2,1,1.5,2,-1,1.5,-2,1,1.5,-2,-1,-1.5,-2,1,-1.5,-2
\t\t}
\t\tPolygonVertexIndex: *24 {
\t\t\ta: 0,1,3,-3,2,3,5,-5,4,5,7,-7,6,7,1,-1,1,7,5,-4,6,0,2,-5
\t\t}
\t}
\tModel: 10, "Model::Red block [101]", "Mesh" {
\t\tProperties70:  {
\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",10,1.5,0
\t\t}
\t}
\tModel: 20, "Model::Blue block [102]", "Mesh" {
\t\tProperties70:  {
\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",16,4.5,0
\t\t\tP: "Lcl Scaling", "Lcl Scaling", "", "A",-1,1,1
\t\t}
\t}
\tModel: 30, "Model::Assembly", "Null" {
\t\tProperties70:  {
\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",100,0,50
\t\t\tP: "Lcl Rotation", "Lcl Rotation", "", "A",0,90,0
\t\t}
\t}
\tMaterial: 40, "Material::Red", "" {
\t\tShadingModel: "phong"
\t\tProperties70:  {
\t\t\tP: "DiffuseColor", "Color", "", "A",1,0,0
\t\t}
\t}
\tMaterial: 50, "Material::Blue", "" {
\t\tShadingModel: "phong"
\t\tProperties70:  {
\t\t\tP: "DiffuseColor", "Color", "", "A",0,0,1
\t\t}
\t}
${
  texture
    ? `\tVideo: 60, "Video::Ignored", "Clip" {
\t\tFilename: "https://example.invalid/texture.png"
\t\tRelativeFilename: "https://example.invalid/texture.png"
\t}
\tTexture: 70, "Texture::Ignored", "" {
\t\tFileName: "https://example.invalid/texture.png"
\t}
`
    : ''
}}
Connections:  {
\tC: "OO",1,10
\tC: "OO",1,20
\tC: "OO",10,30
\tC: "OO",20,30
\tC: "OO",30,0
\tC: "OO",40,10
\tC: "OO",50,20
${options.multiMaterial ? '\tC: "OO",50,10\n' : ''}${texture ? '\tC: "OO",60,70\n\tC: "OP",70,40,"DiffuseColor"\n' : ''}}
`;
}
