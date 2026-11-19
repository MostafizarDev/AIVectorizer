import { convertBuffer, type Options } from "@visioncortex/vtracer";

export type VectorizeOptions = {
  mode: "graphic" | "photo";
  colors: number;
  detail: number;
  speckle: number;
  corner: string;
};

export type VectorizeOutput = {
  svg: string;
  width: number;
  height: number;
};

/**
 * Vectorizes an uploaded image using VTracer's WebAssembly-powered Node API.
 *
 * This adapter currently runs inside a Next.js browser-facing route in the
 * same-origin app deployment. A later performance pass can move the WASM call
 * into a dedicated worker/bundled browser target without changing the UI API.
 */
export async function vectorizeImage(
  file: File,
  options: VectorizeOptions
): Promise<VectorizeOutput> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const engineOptions: Options = {
    preset: options.mode === "photo" ? "photo" : "poster",
    clustering: "color-cluster",
    hierarchical: "stacked",
    mode: "spline",
    filterSpeckle: Math.max(0, Math.min(128, Math.round(options.speckle))),
    colorPrecision: options.mode === "photo" ? 8 : 6,
    layerDifference: Math.max(0, Math.min(255, Math.round((100 - options.detail) * 1.8))),
    cornerThreshold: options.corner === "sharp" ? 35 : options.corner === "smooth" ? 100 : 60,
    lengthThreshold: 4,
    maxIterations: 10,
    spliceThreshold: 45,
    pathPrecision: 3,
    maxColors: Math.max(2, Math.min(64, Math.round(options.colors))),
    optimize: 1
  };

  let svg: string;
  try {
    svg = convertBuffer(bytes, engineOptions);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown VTracer error";
    throw new Error(`Vectorization failed: ${reason}`);
  }

  const dimensions = await getImageDimensions(file);
  return {
    svg: normalizeSvg(svg),
    width: dimensions.width,
    height: dimensions.height
  };
}

function normalizeSvg(svg: string): string {
  if (!svg.includes("<svg")) {
    throw new Error("The vector engine returned an invalid SVG document.");
  }
  return svg.replace(/<\\?xml[^>]*\\?>/g, "").trim();
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image dimensions."));
    };
    image.src = url;
  });
}
