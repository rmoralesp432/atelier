# Accurate topography with a physical-model appearance

Research reviewed 19 October 2026. This is an implementation recommendation, not an installed terrain importer or a verified survey of your site. ATELIER's current street/satellite maps are flat imagery. The expanded map coverage does not add elevation or improve geographic accuracy.

## Enabling source access in Codex

This is a setting for the Codex cloud development environment. It is not a Render variable, an API key, or a switch that installs terrain in ATELIER.

1. In this Codex task, open **Entorno / Environment** for `atelier`.
2. Find **Acceso a Internet / Internet access**. Keep Internet access enabled.
3. Edit **Dominios permitidos adicionales / Additional allowed domains**. Keep the existing domains and add the following hostnames (one per entry, with no `https://`):
   - `edithfarnsworthhouse.org`
   - `epqs.nationalmap.gov`
   - `elevation.nationalmap.gov`
   - `apps.nationalmap.gov`
4. Save the domain changes, then use **Publicar / Publish** in the environment panel. If these domains already appear in the proposed configuration, save/publish that configuration rather than adding duplicates.
5. Return to the task and say **“Published the topography access settings.”** The next step is to recheck access, locate the authoritative dataset, and verify its resolution, vertical accuracy and coordinate/datum metadata.

The additions were saved as a proposed environment configuration. On 19 October 2026 the current runtime still had only the original GitHub/OpenAI/Render domains; the topography additions were not active. No new secret or OpenAI credits are required to allow these public websites. A source may require other download domains later; those must be verified from the actual dataset before adding them.

**Terrain is still pending implementation and data verification.** Enabling these websites allows research; it does not turn flat satellite imagery into topography. For another project site, provide its location and, if available, a surveyor's elevation GeoTIFF or ground-classified LAS/LAZ plus accuracy, CRS and vertical-datum metadata. These are proposed terrain inputs, not currently supported ATELIER import formats.

## Recommended approach

Use a **bare-earth DTM** supplied by a surveyor or an authoritative LiDAR survey with published accuracy metadata. Import a georeferenced elevation GeoTIFF, or ground-classified LAS/LAZ through a separate processing service. For a surveyed design site, this is preferable to treating a generic global elevation map as precise topography. Satellite photographs contain no usable surveyed heights by themselves.

For a site in Mexico, start with the project survey and check INEGI's elevation/LiDAR inventory for that location; this research has not verified coverage or accuracy at the user's site. For a US site, USGS 3DEP is a candidate. Its public LiDAR catalogue distinguishes public EPT data from requester-pays raw LAZ and explicitly notes missing coordinate-system metadata in some sources. Dataset availability alone is not a precision guarantee.

Keep the original elevation surface unchanged. Generate a separate **stepped presentation**:

1. Read the source CRS, horizontal and vertical units, vertical datum, no-data mask, survey date, cell spacing and documented accuracy. Require missing critical metadata rather than guessing it.
2. Transform to a suitable local metric CRS and the project's vertical datum. Preserve the real-world origin and true north independently of the user's modeling axes. Current flat-map Web Mercator approximation is not suitable as the survey transformation pipeline.
3. Crop to a selected site boundary. Work in a worker/service with limits on raster size, vertices and contour bands. Do not download entire regional LiDAR archives into the browser.
4. Generate elevation-band **polygons**, including holes and disconnected islands. Extrude their vertical boundaries into closed, watertight terraces. Merge adjacent coplanar faces and avoid overlapping hidden slabs. Do not fill missing-data holes with invented ground.
5. Offer 0.20 m, 0.50 m and 1.00 m intervals (plus larger values), referenced to an explicit contour datum. Use matte ivory/graphite surfaces, fine contour edges and dark risers: a physical architectural model, with no blue holographic overlay.
6. Keep smooth source elevations available for inspection, measurements and validation. A stepped model is a visualization, not a replacement survey surface. Label its interval and quantization convention.

## Precision: the distinction that matters

**Contour interval is not survey accuracy.** A coarse or undocumented DEM can mathematically produce a contour every 20 cm without having the information to locate those contours reliably. Horizontal cell size is also not vertical accuracy. Do not advertise “20 cm accurate” because 20 cm layers were selected.

The source's published error statistic (for example RMSE or a stated confidence level), vertical datum, acquisition method, vegetation handling and independent checkpoints must be available before describing accuracy. Do not silently convert one statistical measure to another. For 20 cm fabrication-like layers, obtain a survey suitable for the design purpose and have its precision confirmed by the survey provider. If quality is insufficient/unknown, label the result **conceptual topography** and show the source limitation.

With floor-quantized terraces, visual height differs from the source by up to one layer interval even with perfect input data. That display error is separate from survey error. Report both rather than claiming the stepped surface is exact. Survey-grade dimensions/placement should read the original surface.

## Libraries and services evaluated

| Component                       | Recommendation                                                     | Reason / limit                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Raster import                   | GeoTIFF.js in a worker for bounded local GeoTIFF/COG windows       | Supports windows, resolution selection and worker decoding; reading GeoKeys is not a complete coordinate/vertical-datum transformation.      |
| Projection and datum conversion | GDAL/PROJ processing service                                       | GDAL documents horizontal/vertical transformation, geoid grids and unit handling. Required geoid grids must actually be available.           |
| LiDAR ground preparation        | PDAL, existing ground classification first                         | SMRF can classify ground points; automated classification must be checked against the site, especially walls, buildings and steep terrain.   |
| Contour bands                   | GDAL contour polygon generation                                    | Supports interval, offset, min/max elevation attributes and no-data handling; use polygon output rather than drawing cosmetic contour lines. |
| Closed stepped geometry         | Existing Manifold kernel after validated polygon/mesh construction | Suitable for closed solid checks/CSG. It cannot supply missing elevations or geodetic accuracy.                                              |

A separate bounded processing job is preferable to adding heavy GDAL/PDAL workloads to the current free Render web process. Preserve the existing app service; add processing only when an actual dataset and workload are known. Model/voice credits are not needed to read a survey or generate deterministic contours.

## Verification required before shipping terrain

- Known analytic slopes and surveyed checkpoints: confirm CRS, meters/feet, datum and origin before meshing.
- 0.2/0.5/1 m band heights, negative elevations, holes, islands and steep cliffs; no-data stays absent.
- Closed mesh, correct winding, nonzero volume, no cracks or self intersections; contour boundaries agree with the source within the declared sampling/processing tolerance.
- Rotation/alignment with true north, section cuts, project backup and restore preserve source and derived data independently.
- Bound performance on phone and desktop; progressive tile loading, cancellation, source attribution and documented data quality.

## Sources actually reviewed

- [GDAL contour implementation documentation](https://github.com/OSGeo/gdal/blob/master/doc/source/programs/gdal_contour.rst): polygon output, interval, elevation attributes and no-data options.
- [GDAL warp documentation](https://github.com/OSGeo/gdal/blob/master/doc/source/programs/gdalwarp.rst): coordinate/vertical transformations, geoid grids and units.
- [GeoTIFF.js documentation](https://github.com/geotiffjs/geotiff.js): bounded raster reads, metadata and worker decoding.
- [PDAL SMRF documentation](https://github.com/PDAL/PDAL/blob/master/doc/stages/filters.smrf.md): ground classification and ground-only filtering.
- [AWS Open Data registry: USGS 3DEP LiDAR](https://github.com/awslabs/open-data-registry/blob/main/datasets/usgs-lidar.yaml): public EPT vs requester-pays raw LAZ; CRS/coverage caveats. This is a catalogue, not a survey accuracy certificate.

No site-specific terrain was downloaded or validated in this work. The next prerequisite is the project's location and an authoritative elevation dataset with its accuracy/CRS/vertical-datum metadata.
