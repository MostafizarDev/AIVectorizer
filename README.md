# AIVectorizer

A browser-first raster-to-vector web application focused on editable SVG output.

## Current status

This repository contains the initial Next.js application shell and workspace UI. The VTracer adapter is an integration boundary; the browser-compatible engine build still needs to be selected and wired before production vectorization works end-to-end.

## Planned capabilities

- PNG, JPEG, and WebP upload
- Graphic and photo-oriented vectorization workflows
- Adjustable color and path simplification controls
- Editable SVG preview and download
- Browser-first processing, with optional server processing for larger jobs later

## Tech stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS v4
- VTracer integration adapter
- Lucide icons

## Local development

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```bash
npm run build
```

## Architecture notes

The UI is browser-based. Do not send user images to a server unless a future feature explicitly needs server-side processing and the user is informed. For a production browser vectorizer, bundle a VTracer WASM build with a documented browser API and run it in a Web Worker to keep the interface responsive.

## License

MIT. Third-party dependencies and model assets retain their respective licenses.
