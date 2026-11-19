# AIVectorizer

A web-based raster-to-vector application focused on editable SVG output.

## Current implementation

- Redesigned responsive vector studio workspace
- Server-side image enhancement pipeline using Sharp
- Optional 1×, 2×, and 3× Lanczos resampling (bounded to a 4096 px maximum side)
- Palette-based color reduction before tracing
- Configurable near-identical SVG fill-color merging after tracing
- PNG, JPEG, and WebP upload (20 MB application limit)
- Graphic and photo tracing presets
- Adjustable color count, detail, speckle reduction, and tracing corner settings
- VTracer-powered SVG conversion endpoint
- Compare, Vector, and Outlines views
- Zoom in, zoom out, fit-to-screen, and 1:1 controls
- SVG shape selection and region list
- Palette recoloring for matching fills and selected shapes
- Delete selected shape and move selected shape with nudge controls
- Preview background choices and exact-white SVG shape removal
- Corner join controls, undo/redo history, and SVG download

## Image enhancement pipeline

The API auto-orients the uploaded raster, resamples it with Lanczos3, applies restrained sharpening, quantizes the raster to the selected palette size, runs VTracer, then merges close solid hex fill colors using a configurable RGB-distance threshold. This is deterministic image processing, not AI super-resolution: it can improve resampling and reduce palette noise, but cannot reconstruct detail that was never present in the source. Strong color merging can remove subtle shading, so use lower values for portraits and photos.

## Editor limitations

The editor modifies the generated SVG in the browser session. It does not yet provide freehand path-node editing, drag-to-move, grouping, multi-select, true background segmentation, or geometry reconstruction. The Corners panel changes SVG stroke joins only; it does not regenerate Bézier curves. Fit-to-screen is calculated from the SVG dimensions and canvas viewport.

## Tech stack

- Next.js App Router + React + TypeScript
- Tailwind CSS v4
- `@visioncortex/vtracer` (WebAssembly build)
- Lucide icons

## Local development

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Production build

```bash
npm run build
npm start
```

## Vectorization API

`POST /api/vectorize` accepts multipart form data:

- `file`: PNG, JPEG, or WebP
- `mode`: `graphic` or `photo`
- `colors`: 2–64
- `detail`: 0–100
- `speckle`: 0–128
- `corner`: `sharp`, `medium`, or `smooth`

The route uses the official VTracer Node/WebAssembly API to return an SVG document. The file is processed in the application runtime and is not saved to persistent storage.

## Important architecture note

The interface is browser-based, but vectorization currently runs on a same-origin Next.js API route using VTracer's Node.js/WebAssembly build. Uploaded files are processed in the request and are not saved to persistent project storage. This is not yet fully client-only processing. A future optimization can move conversion into a dedicated browser Web Worker using a browser-targeted WASM build.

For public deployment, configure suitable request/body limits and rate limiting. The Vercel deployment plan and function duration limits should be checked against the expected image sizes and user traffic.

## License

Project source code: MIT. Third-party packages and model assets retain their respective licenses.
