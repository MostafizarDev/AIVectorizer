import { NextRequest, NextResponse } from "next/server";
import { convertBuffer, type Options } from "@visioncortex/vtracer";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "An image file is required." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only PNG, JPEG, and WebP images are supported." }, { status: 415 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "The selected image is empty." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image exceeds the 20 MB limit." }, { status: 413 });
    }

    const mode = form.get("mode") === "photo" ? "photo" : "graphic";
    const colors = clampNumber(form.get("colors"), mode === "photo" ? 64 : 24, 2, 64);
    const detail = clampNumber(form.get("detail"), 88, 0, 100);
    const speckle = clampNumber(form.get("speckle"), 2, 0, 128);
    const corner = String(form.get("corner") || "medium");

    // VTracer's layerDifference is a color/gradient threshold, not a
    // percentage. The previous UI mapped detail to values as high as 180,
    // which discarded subtle color regions and facial details.
    const layerDifference = mode === "photo"
      ? Math.round(24 - (detail / 100) * 20) // 4..24
      : Math.round(48 - (detail / 100) * 40); // 8..48

    const options: Options = {
      preset: mode === "photo" ? "photo" : "poster",
      clustering: "color-cluster",
      // Cutout creates a seam-free mosaic for flat artwork; stacked layers
      // generally retain tonal layering better for photographs.
      hierarchical: mode === "photo" ? "stacked" : "cutout",
      mode: "spline",
      filterSpeckle: speckle,
      colorPrecision: mode === "photo" ? 8 : 7,
      layerDifference,
      cornerThreshold: corner === "sharp" ? 35 : corner === "smooth" ? 100 : 60,
      lengthThreshold: 4,
      maxIterations: 10,
      spliceThreshold: 45,
      simplify: detail >= 85 ? 0.5 : detail >= 60 ? 1 : 1.8,
      maxColors: colors,
      optimize: 2,
      pathPrecision: 3
    };

    const input = new Uint8Array(await file.arrayBuffer());
    const svg = convertBuffer(input, options);

    if (!svg.includes("<svg")) {
      throw new Error("The vector engine returned an invalid SVG document.");
    }

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vectorization failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function clampNumber(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}
