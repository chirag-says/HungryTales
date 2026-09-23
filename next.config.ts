import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/wasm packages that must not be bundled into server chunks.
  serverExternalPackages: ["@electric-sql/pglite", "cloudinary"],
  poweredByHeader: false,
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
