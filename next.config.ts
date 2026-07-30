import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "acdn-us.mitiendanube.com" },
      { protocol: "https", hostname: "erexit3d.com" },
      { protocol: "https", hostname: "kimera3d.com.ar" },
      { protocol: "https", hostname: "laboratorio3d.com.ar" },
      { protocol: "https", hostname: "proyectocolor.com.ar" },
      { protocol: "https", hostname: "tp3d.com.ar" },
    ],
  },
};

export default nextConfig;
