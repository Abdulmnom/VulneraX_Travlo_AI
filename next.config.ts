import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Required for Docker deployment — produces a minimal self-contained build
  output: "standalone",
  // MongoDB driver uses native Node modules; must not be bundled
  serverExternalPackages: ["mongodb"],
};

export default nextConfig;
