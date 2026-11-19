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
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image exceeds the 20 MB limit." }, { status: 413 });
    }

    const mode = form.get("mode") === "photo" ? "photo" : "graphic";
    const colors = clampNumber(form.get("colors"), 16, 2, 64);
    const detail = clampNumber(form.get("detail"), 70, 0, 100);
    const speckle = clampNumber(form.get("speckle"), 4, 0, 128);
    const corner = String(form.get("corner") || "medium");

    const options: Options = {
      preset: mode === "photo" ? "photo" : "poster",
      clustering: "color-cluster",
      hierarchical: "stacked",
      mode: "spline",
      filterSpeckle: speckle,
      colorPrecision: mode === "photo" ? 8 : 6,
      layerDifference: Math.round((100 - detail) * 1.8),
      cornerThreshold: corner === "sharp" ? 35 : corner === "smooth" ? 100 : 60,
      maxColors: colors,
      optimize: 1,
      pathPrecision: 3
    };

    const input = new Uint8Array(await file.arrayBuffer());
    const svg = convertBuffer(input, options);

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
