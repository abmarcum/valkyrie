import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    "192.168.1.159",
    "169.254.58.61",
    "localhost:3000",
    "host.docker.internal"
  ]
};

export default nextConfig;
