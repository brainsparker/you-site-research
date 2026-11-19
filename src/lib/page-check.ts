import type { ExtractParams, ExtractResult } from "./you-client";

/**
 * Helpers behind the "check" panel: build the Extract request for a consulted
 * page, read the response, and test whether the excerpts the research agent
 * cited are actually on the page. Pure functions, no React, no network.
 */

/**
 * Whole-request cap sent to the Extract API, in seconds. Kept under hosted
 * platforms' 20 second request ceiling so a slow page comes back as a typed
 * `timeout` error from the API instead of a connection the platform cut.
 */
export const PREVIEW_TIMEOUT_SECONDS = 15;

/** Characters of Markdown rendered before the panel truncates. */
export const PREVIEW_CHAR_LIMIT = 12000;

export function isPdfUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

/**
 * The Extract request for a preview.
 * - `live` asks for a fresh crawl (extraction_source: "fetch") instead of
 *   the default blend, which may serve a cached copy.
 * - PDFs use parse_effort "lite": the embedded text is enough for a
 *   preview and it avoids the per-page charge of the default "standard".
 */
export function previewParams(
  url: string,
  options: { live?: boolean } = {},
): ExtractParams {
  const params: ExtractParams = { url, timeout: PREVIEW_TIMEOUT_SECONDS };
  if (options.live) params.extraction_source = "fetch";
  if (isPdfUrl(url)) params.parse_effort = "lite";
  return params;
}

export type PageText = {
  title: string | null;
  markdown: string;
};

/**
 * Read an Extract response. Returns null when nothing was extracted: the
 * API answers 200 with no `contents` in that case, so check before reading.
 */
export function readExtract(data: ExtractResult | null | undefined): PageText | null {
  const markdown = data?.contents?.full_page?.markdown;
  if (typeof markdown !== "string" || markdown.trim() === "") return null;
  const title =
    typeof data?.title === "string" && data.title.trim()
      ? data.title.trim()
      : null;
  return { title, markdown };
}

/** Cut long Markdown at a line break near the limit. */
export function truncateMarkdown(
  markdown: string,
  limit = PREVIEW_CHAR_LIMIT,
): { text: string; truncated: boolean } {
  if (markdown.length <= limit) return { text: markdown, truncated: false };
  const cut = markdown.lastIndexOf("\n", limit);
  const end = cut > limit * 0.8 ? cut : limit;
  return { text: markdown.slice(0, end), truncated: true };
}

/**
 * Reduce text to lowercase words so an excerpt and a page can be compared
 * across Markdown syntax, punctuation, and whitespace differences.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    // [label](url) and ![alt](url) keep only the label.
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Bare URLs carry no words worth matching.
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export type SnippetMatch = "found" | "partial" | "missing";

export type SnippetCheck = {
  snippet: string;
  match: SnippetMatch;
};

/** Words per window when looking for part of an excerpt on the page. */
const WINDOW_WORDS = 8;

/**
 * Is this cited excerpt on the page?
 * - "found": the whole excerpt appears, ignoring formatting.
 * - "partial": at least one run of 8 consecutive words appears. Excerpts
 *   are often trimmed or stitched from several places, so this is common.
 * - "missing": no run of 8 words appears. The page may have changed since
 *   it was indexed, or the preview may be truncated or a different render.
 */
export function matchSnippet(
  normalizedPage: string,
  snippet: string,
): SnippetMatch {
  const needle = normalizeForMatch(snippet);
  if (!needle) return "missing";
  const page = ` ${normalizedPage} `;
  if (page.includes(` ${needle} `)) return "found";

  const words = needle.split(" ");
  if (words.length <= WINDOW_WORDS) return "missing";
  for (let i = 0; i + WINDOW_WORDS <= words.length; i++) {
    const run = words.slice(i, i + WINDOW_WORDS).join(" ");
    if (page.includes(` ${run} `)) return "partial";
  }
  return "missing";
}

/** Check every cited excerpt for a source against the page's Markdown. */
export function checkSnippets(
  markdown: string,
  snippets: readonly string[] | undefined,
): SnippetCheck[] {
  if (!snippets || snippets.length === 0) return [];
  const page = normalizeForMatch(markdown);
  return snippets
    .filter((s) => typeof s === "string" && s.trim() !== "")
    .map((snippet) => ({ snippet, match: matchSnippet(page, snippet) }));
}
