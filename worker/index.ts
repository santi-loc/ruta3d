/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

type RateLimitEntry = { count: number; resetAt: number };

const imageRateLimitWindowMs = 60_000;
const imageRateLimitMax = 60;
const imageRateLimits = new Map<string, RateLimitEntry>();
const allowedImageHosts = new Set([
  "acdn-us.mitiendanube.com",
  "erexit3d.com",
  "www.i3dtienda.com.ar",
  "kimera3d.com.ar",
  "laboratorio3d.com.ar",
  "d22fxaf9t8d39k.cloudfront.net",
  "proyectocolor.com.ar",
  "tp3d.com.ar",
]);
const dangerousQueryPattern =
  /<|>|\{|\}|\[|\]|`|\\|javascript:|data:|vbscript:|on\w+\s*=|<\/?script|<\/?iframe|<\/?object|<\/?embed/gi;

function clientKey(request: Request) {
  return request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous";
}

function isRateLimited(request: Request) {
  const now = Date.now();
  const key = clientKey(request);
  const current = imageRateLimits.get(key);

  if (!current || current.resetAt <= now) {
    imageRateLimits.set(key, { count: 1, resetAt: now + imageRateLimitWindowMs });
    return false;
  }

  current.count += 1;
  return current.count > imageRateLimitMax;
}

function isAllowedImageRequest(request: Request) {
  const url = new URL(request.url);
  const rawSource = url.searchParams.get("url") ?? "";
  const width = Number(url.searchParams.get("w"));
  const quality = Number(url.searchParams.get("q") ?? "75");

  if (!Number.isInteger(width) || width <= 0) return false;
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) return false;
  if (!rawSource || rawSource.length > 1_000) return false;
  if (rawSource.startsWith("/")) return !rawSource.startsWith("//") && !rawSource.toLowerCase().endsWith(".svg");

  try {
    const source = new URL(rawSource);
    return source.protocol === "https:" &&
      allowedImageHosts.has(source.hostname) &&
      !source.pathname.toLowerCase().endsWith(".svg");
  } catch {
    return false;
  }
}

function sanitizeQueryParam(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(dangerousQueryPattern, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function sanitizeIncomingRequest(request: Request) {
  const url = new URL(request.url);
  const rawQuery = url.searchParams.get("q");
  if (rawQuery === null) return request;

  const safeQuery = sanitizeQueryParam(rawQuery);
  if (safeQuery === rawQuery) return request;

  if (safeQuery) {
    url.searchParams.set("q", safeQuery);
  } else {
    url.searchParams.delete("q");
  }

  return new Request(url, request);
}

function withSecurityHeaders(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);

  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' https: data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'",
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");

  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    request = sanitizeIncomingRequest(request);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return withSecurityHeaders(
        new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "GET, HEAD" },
        }),
        request,
      );
    }

    const url = new URL(request.url);
    let response: Response;

    if (url.pathname === "/_vinext/image") {
      if (!isAllowedImageRequest(request)) {
        return withSecurityHeaders(new Response("Invalid image request", { status: 400 }), request);
      }

      if (isRateLimited(request)) {
        return withSecurityHeaders(new Response("Too many image requests", { status: 429 }), request);
      }

      const images = env.IMAGES;
      // Local development does not provide Cloudflare's image binding. Let
      // vinext handle the request instead of calling a missing ASSETS binding.
      if (!images) return withSecurityHeaders(await handler.fetch(request, env, ctx), request);

      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await images.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    } else {
      response = await handler.fetch(request, env, ctx);
    }

    return withSecurityHeaders(response, request);
  },
};

export default worker;
