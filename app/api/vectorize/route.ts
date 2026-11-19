import { NextRequest, NextResponse } from "next/server";
import { convertBuffer, type Options } from "@visioncortex/vtracer";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 4096;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "An image file is required." }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Only PNG, JPEG, and WebP images are supported." }, { status: 415 });
    if (!file.size) return NextResponse.json({ error: "The selected image is empty." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image exceeds the 20 MB limit." }, { status: 413 });

    const mode = form.get("mode") === "photo" ? "photo" : "graphic";
    const colors = clampNumber(form.get("colors"), mode === "photo" ? 64 : 24, 2, 64);
    const detail = clampNumber(form.get("detail"), 88, 0, 100);
    const speckle = clampNumber(form.get("speckle"), 2, 0, 128);
    const upscale = clampNumber(form.get("upscale"), 2, 1, 3);
    const mergeStrength = clampNumber(form.get("mergeStrength"), mode === "photo" ? 12 : 22, 0, 80);
    const corner = String(form.get("corner") || "medium");

    // Stage 1: orient, high-quality resampling, and restrained edge enhancement.
    const input = Buffer.from(await file.arrayBuffer());
    const source = sharp(input, { limitInputPixels: 100_000_000, failOn: "error" });
    const metadata = await source.metadata();
    if (!metadata.width || !metadata.height) throw new Error("Could not read image dimensions.");
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;
    const targetWidth = Math.min(Math.round(originalWidth * upscale), MAX_SIDE);
    const targetHeight = Math.min(Math.round(originalHeight * upscale), MAX_SIDE);
    const scale = Math.min(targetWidth / originalWidth, targetHeight / originalHeight, upscale);

    let pipeline = sharp(input, { limitInputPixels: 100_000_000 })
      .rotate()
      .resize({
        width: Math.max(1, Math.round(originalWidth * scale)),
        height: Math.max(1, Math.round(originalHeight * scale)),
        fit: "inside",
        withoutEnlargement: false,
        kernel: sharp.kernel.lanczos3
      })
      .toColourspace("srgb");

    pipeline = mode === "graphic"
      ? pipeline.sharpen({ sigma: 0.7, m1: 0.4, m2: 1.2 })
      : pipeline.sharpen({ sigma: 0.45, m1: 0.25, m2: 0.8 });

    // Stage 2: reduce near-duplicate colors before tracing.
    const prepared = await pipeline.png({
      palette: true,
      colours: colors,
      quality: 100,
      effort: 7,
      dither: mode === "photo" ? 0.65 : 0.25
    }).toBuffer();

    const preparedMeta = await sharp(prepared).metadata();
    const layerDifference = mode === "photo"
      ? Math.round(24 - (detail / 100) * 20)
      : Math.round(48 - (detail / 100) * 40);

    // Stage 3: trace the enhanced, palette-reduced PNG.
    const options: Options = {
      preset: mode === "photo" ? "photo" : "poster",
      clustering: "color-cluster",
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

    let svg = convertBuffer(new Uint8Array(prepared), options);
    if (!svg.includes("<svg")) throw new Error("The vector engine returned an invalid SVG document.");

    // Stage 4: merge visually similar solid fills in the resulting SVG.
    const merged = mergeSimilarFills(svg, mergeStrength);
    svg = merged.svg;

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-AV-Original-Dimensions": originalWidth + "x" + originalHeight,
        "X-AV-Processed-Dimensions": (preparedMeta.width || 0) + "x" + (preparedMeta.height || 0),
        "X-AV-Upscale-Factor": scale.toFixed(2),
        "X-AV-Colors-Merged": String(merged.mergedCount)
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

function mergeSimilarFills(svg: string, strength: number) {
  if (strength <= 0) return { svg, mergedCount: 0 };
  const threshold = strength * 1.35;
  const representatives: Array<{ color: string; rgb: [number, number, number] }> = [];
  const replacements = new Map<string, string>();
  const colors = Array.from(svg.matchAll(/fill=["'](#[0-9a-fA-F]{6})["']/g), match => match[1].toLowerCase());
  for (const color of colors) {
    if (replacements.has(color)) continue;
    const rgb = hexToRgb(color);
    let nearest: { color: string; rgb: [number, number, number] } | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of representatives) {
      const distance = Math.sqrt(
        Math.pow(rgb[0] - candidate.rgb[0], 2) +
        Math.pow(rgb[1] - candidate.rgb[1], 2) +
        Math.pow(rgb[2] - candidate.rgb[2], 2)
      );
      if (distance < nearestDistance) { nearestDistance = distance; nearest = candidate; }
    }
    if (nearest && nearestDistance <= threshold) replacements.set(color, nearest.color);
    else { representatives.push({ color, rgb }); replacements.set(color, color); }
  }
  let mergedCount = 0;
  const output = svg.replace(/fill=(["'])(#[0-9a-fA-F]{6})\1/g, (whole, quote: string, color: string) => {
    const replacement = replacements.get(color.toLowerCase()) || color;
    if (replacement !== color.toLowerCase()) mergedCount++;
    return "fill=" + quote + replacement + quote;
  });
  return { svg: output, mergedCount };
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16)
  ];
}
