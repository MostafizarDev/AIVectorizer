import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },

  // VTracer loads its WebAssembly binary from the package directory at runtime.
  // Keep the package external to webpack and include its WASM assets in the
  // serverless function's file-tracing output.
  serverExternalPackages: ["@visioncortex/vtracer", "sharp"],
  outputFileTracingIncludes: {
    "/api/vectorize": ["./node_modules/@visioncortex/vtracer/**/*", "./node_modules/sharp/**/*", "./node_modules/@img/sharp-*/**/*"]
  }
};

export default nextConfig;
