# Panoramas and phone navigation

## Move around a model on iPhone

Use the left toolbar:

- **Orbit:** one finger turns around the model.
- **Pan:** one finger moves the view sideways/up/down.
- In either mode, **two fingers pan and pinch to zoom**. Tapping still selects objects, but modeling handles stay disabled until Edit.
- **Edit:** enables selected-object handles and the modeling tools. Use Orbit or Pan again when you want to navigate freely. Draw/Create remain available from the toolbar.

The desktop mouse controls remain available. Phone navigation does not move geometry or add undo steps. Desktop drag-selection remains a mouse operation; use the object list's selection controls for phone multi-selection.

## Open a panorama

1. Open **Tools → Panoramas** on a phone, or **Panoramas** in the desktop toolbar.
2. Tap **Import** and select a JPG, PNG or WebP panorama.
3. Drag with one finger to look around. Pinch to zoom; desktop supports drag, wheel and arrow keys. Reset returns to the image center.
4. Tap **Phone motion** to look around by turning the phone. On iPhone, allow the browser's Motion & Orientation request. This requires HTTPS and an orientation-capable browser. If access is denied or sensors provide no data, an explanatory message appears and touch navigation remains available. Dragging pauses motion control.
5. **Back to model** returns to your unchanged model. The panorama stays saved in that project and is included in ATELIER JSON backups. Remove asks for confirmation.

For a full spherical view, use a **2:1 equirectangular 360° image** from a 360 camera or renderer. Wider partial panoramas start at 180° coverage; adjust **Settings → Image coverage** to the angle actually captured. The viewer cannot infer that angle reliably from image dimensions. It maps images as equirectangular panoramas; cylindrical phone panoramas may show projection distortion. It does not invent the unseen parts of a partial photo, reconstruct geometry, or let you walk through a photograph.

Source photos can be up to **50 MB / 80 megapixels**. The saved viewing copy is resized to at most **4096 × 2048**, JPEG quality 90%, to bound phone GPU memory. Up to eight panoramas fit in a project's 32-million-character photo budget. This is separate from the 200 MB mesh-file import limit. Images are processed locally, without AI calls, external uploads or API credits. Keep your original photos separately.

## Research and verification boundary

Panoraven was the user's behavioral reference, but this cloud environment could not access its site (network-policy CONNECT 403). Its implementation was not inspected or copied. Public [Pannellum documentation](https://github.com/mpetroff/pannellum/blob/master/doc/json-config-parameters.md) was inspected for full/partial panorama coverage, drag/zoom behavior and optional orientation controls. ATELIER uses its existing Three.js dependency and its own interface.

Automated touch tests use Chromium's real touch-event dispatch and render actual Three.js geometry/photos. Motion tests explicitly simulate permission results and sensor readings. Physical iPhone Safari orientation, performance and device-specific permission behavior still need a real-device check. No paid AI or voice requests are involved in these features.
