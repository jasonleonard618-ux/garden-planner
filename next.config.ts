import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // laz-perf (lidar decompression) loads a .wasm file from its own folder,
  // so keep it out of the server bundle and ship its files with the function.
  serverExternalPackages: ["copc", "laz-perf"],
  outputFileTracingIncludes: {
    "/api/surface": ["./node_modules/laz-perf/lib/**/*"],
  },
};

export default nextConfig;
