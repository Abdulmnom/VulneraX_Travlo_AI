import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/commons/**",
      },
    ],
    qualities: [75],
  },
  // Required for Docker deployment — produces a minimal self-contained build
  output: "standalone",
  // MongoDB driver uses native Node modules; must not be bundled
  serverExternalPackages: ["mongodb", "@google-cloud/speech", "@google-cloud/text-to-speech"],
  // Exclude voice scripts from static tracing to avoid build warnings
  outputFileTracingExcludes: {
    "*": ["./lib/voice/whisper_transcribe.py"],
  },
};

export default nextConfig;
