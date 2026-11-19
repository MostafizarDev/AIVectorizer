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

type VTracerModule = {
  default?: (options?: Record<string, unknown>) => Promise<unknown>;
  imageToSVG?: (data: Uint8Array, options?: Record<string, unknown>) => string | Promise<string>;
  image_to_svg?: (data: Uint8Array, options?: Record<string, unknown>) => string | Promise<string>;
};

/**
 * Browser-side adapter for the VTracer WebAssembly package.
 * The dynamic import keeps the vector engine out of the initial page bundle.
 */
export async function vectorizeImage(
  file: File,
  options: VectorizeOptions
): Promise<VectorizeOutput> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let engine: VTracerModule;
  try {
    engine = (await import("@vtracer/node")) as unknown as VTracerModule;
  } catch {
    throw new Error(
      "The vector engine could not be loaded in this browser build. The VTracer browser adapter needs to be configured for the published WASM bundle."
    );
  }

  const config = {
    color_mode: options.mode === "photo" ? "color" : "color",
    hierarchical: "stacked",
    mode: "spline",
    filter_speckle: Math.max(0, Math.round(options.speckle)),
    corner_threshold: options.corner === "sharp" ? 60 : options.corner === "smooth" ? 150 : 100,
    length_threshold: Math.max(3, 10 - options.detail / 15),
    max_iterations: 10,
    splice_threshold: 45,
    path_precision: 3,
    color_precision: options.mode === "photo" ? 8 : 6,
    layer_difference: Math.max(8, Math.round((100 - options.detail) / 5)),
    color_count: options.colors
  };

  const convert = engine.imageToSVG ?? engine.image_to_svg;
  if (!convert) {
    throw new Error(
      "The installed VTracer package does not expose the expected browser conversion API yet. The engine adapter must be aligned with the chosen WASM build."
    );
  }

  const svg = await convert(bytes, config);
  const dimensions = await getImageDimensions(file);
  return { svg: normalizeSvg(String(svg)), width: dimensions.width, height: dimensions.height };
}

function normalizeSvg(svg: string): string {
  if (!svg.includes("<svg")) throw new Error("The vector engine returned an invalid SVG document.");
  return svg.replace(/<\?xml[^>]*\?>/g, "").trim();
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
