import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "acdn-us.mitiendanube.com" },
      { protocol: "https", hostname: "creaxis.com.ar" },
      { protocol: "https", hostname: "www.dino3d.com.ar" },
      { protocol: "https", hostname: "erexit3d.com" },
      { protocol: "https", hostname: "gprint3d.com.ar" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "ik.imagekit.io" },
      { protocol: "https", hostname: "www.i3dtienda.com.ar" },
      { protocol: "https", hostname: "www.dino3d.com.ar" },
      { protocol: "https", hostname: "kimera3d.com.ar" },
      { protocol: "https", hostname: "laboratorio3d.com.ar" },
      { protocol: "https", hostname: "d22fxaf9t8d39k.cloudfront.net" },
      { protocol: "https", hostname: "proyectocolor.com.ar" },
      { protocol: "https", hostname: "starimpression3d.com" },
      { protocol: "https", hostname: "www.tecknicam3d.com.ar" },
      { protocol: "https", hostname: "tp3d.com.ar" },
      { protocol: "https", hostname: "cdn.cafecito.app" },
    ],
  },
};

export default nextConfig;
