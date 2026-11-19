# AIVectorizer

A browser-first raster-to-vector web application focused on editable SVG output.

## Current status

The initial Next.js workspace is in place with:
- Responsive dark workspace UI
- PNG, JPEG, and WebP upload (20 MB application limit)
- Graphic and photo presets
- Adjustable color count, detail, speckle reduction, and corner handling
- VTracer-powered SVG conversion endpoint
- SVG preview and download

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

The interface is browser-based. The first vectorization implementation calls a same-origin Next.js API route, which executes VTracer's WebAssembly module in the Node.js runtime. This is reliable for a low-cost MVP deployment, but it is not yet fully client-only processing. A future optimization can move conversion into a dedicated browser Web Worker using a browser-targeted WASM build.

For public deployment, configure suitable request/body limits and rate limiting. The Vercel deployment plan and function duration limits should be checked against the expected image sizes and user traffic.

## License

Project source code: MIT. Third-party packages and model assets retain their respective licenses.
