import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  const interfaces = os.networkInterfaces();
  let localIp = null;

  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const info of iface) {
      // Find the first IPv4, non-internal address
      if (info.family === "IPv4" && !info.internal) {
        localIp = info.address;
        break;
      }
    }
    if (localIp) break;
  }

  // Fallback to localhost if no external IP was found
  return NextResponse.json({ ip: localIp || "localhost" });
}
