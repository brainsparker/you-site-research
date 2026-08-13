/**
 * Edge proxy for the You.com API.
 *
 * Why this exists: api.you.com does not serve CORS headers, so browsers cannot
 * call it directly. This route forwards requests server-side on Webflow Cloud's
 * edge runtime. The visitor's API key arrives as an x-api-key header, is
 * forwarded upstream in the same request, and is never stored or logged.
 *
 * Abuse guard: only the API paths listed below may be proxied, so this route
 * cannot be used as an open proxy.
 *
 * Note: do NOT add `export const runtime = "edge"` here. Webflow Cloud builds
 * with OpenNext, which rejects edge-runtime route handlers; this route already
 * runs on Cloudflare Workers via OpenNext's Node-compatible runtime.
 */
const UPSTREAM = "https://api.you.com";

const ALLOWED_PATHS = [
  "v1/search",
  "v1/contents",
  "v1/research",
  "v1/finance_research",
];

// Never forward these from the incoming request.
const STRIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "cookie",
  "accept-encoding",
]);

// Only these come back to the browser (content-type covers SSE streams).
const FORWARD_RESPONSE_HEADERS = new Set([
  "content-type",
  "x-request-id",
]);

async function proxy(req: Request, pathSegments: string[]): Promise<Response> {
  const joined = pathSegments.join("/");

  const allowed = ALLOWED_PATHS.some(
    (p) => joined === p || joined.startsWith(`${p}/`),
  );
  if (!allowed) {
    return Response.json(
      { error: `Path not allowed: /${joined}` },
      { status: 404 },
    );
  }

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return Response.json(
      {
        error:
          "Missing x-api-key header. Add your You.com API key in the app to continue.",
      },
      { status: 401 },
    );
  }

  const incoming = new URL(req.url);
  const upstreamUrl = `${UPSTREAM}/${joined}${incoming.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set("x-api-key", apiKey);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const upstream = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    // Request bodies here are small JSON payloads; buffering avoids
    // streaming-body (duplex) edge cases across runtimes.
    body: hasBody ? await req.arrayBuffer() : undefined,
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (FORWARD_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  // Stream the upstream body straight through (supports SSE).
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: Request, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
