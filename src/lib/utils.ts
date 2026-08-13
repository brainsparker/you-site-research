// The mount path Webflow Cloud serves this app from (e.g. "/demos/template").
// Injected at build time by next.config.ts. Empty string in local dev.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Prefix a same-app URL with the Webflow Cloud mount path.
 * Next.js does NOT do this automatically for client-side fetch calls,
 * so every fetch to our own API routes must go through withBase().
 */
export function withBase(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
