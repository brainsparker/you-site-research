import { withBase } from "./utils";

/**
 * Browser-side client for the You.com API, routed through this app's own
 * /api/you proxy (api.you.com does not serve CORS headers, so direct browser
 * calls are not possible). The visitor's key is attached per request.
 *
 * Response typing is intentionally loose: exact response contracts should be
 * confirmed against https://you.com/docs and tightened per app.
 */

export type YouSearchResult = {
  url?: string;
  title?: string;
  name?: string;
  description?: string;
  snippet?: string;
  snippets?: string[];
  [key: string]: unknown;
};

export class YouApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "YouApiError";
  }
}

async function request<T>(
  path: string,
  apiKey: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await fetch(withBase(`/api/you/${path}`), {
    method: init.method ?? "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  });

  if (!res.ok) {
    let detail = res.statusText || `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; detail?: string };
      detail = data.error ?? data.detail ?? detail;
    } catch {
      // Non-JSON error body; keep the status text.
    }
    throw new YouApiError(detail, res.status);
  }

  return (await res.json()) as T;
}

/** POST /v1/search: real-time, LLM-ready web results. */
export function search(
  apiKey: string,
  params: { query: string; [key: string]: unknown },
  signal?: AbortSignal,
): Promise<unknown> {
  return request("v1/search", apiKey, { body: params, signal });
}

/** POST /v1/contents: clean page content for one or more URLs. */
export function contents(
  apiKey: string,
  params: { urls: string[]; [key: string]: unknown },
  signal?: AbortSignal,
): Promise<unknown> {
  return request("v1/contents", apiKey, { body: params, signal });
}

// --- Research API (contract verified against you.com/docs, 2026-08-12) ---

export type ResearchEffort =
  | "lite"
  | "standard"
  | "deep"
  | "exhaustive"
  | "frontier";

export type ResearchSource = {
  url: string;
  title?: string;
  /** Relevant excerpts from the source used in the answer. */
  snippets?: string[];
};

export type ResearchOutput = {
  output: {
    /**
     * Markdown with numbered citations like [[1]] referencing sources.
     * A JSON object instead when output_schema was provided.
     */
    content: string | Record<string, unknown>;
    content_type: "text" | "object";
    sources: ResearchSource[];
  };
  warnings: string[];
};

/** Returned immediately when background: true. */
export type ResearchTask = {
  task_id: string;
  type: string;
  status: string;
  stream_url: string;
  created_at: string;
};

export type ResearchTaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type ResearchTaskDetail = {
  id: string;
  task_type: string;
  status: ResearchTaskStatus;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
  error: string | null;
  input: unknown;
  result: ResearchOutput | null;
};

/**
 * Constrain which web sources the research agent may search and visit.
 * include_domains cannot be combined with exclude_domains or boost_domains,
 * and boost_domains cannot be combined with include_domains (max 500 each).
 */
export type SourceControl = {
  /** Only return results from these domains. */
  include_domains?: string[];
  /** Never return results from these domains (also blocks browsing them). */
  exclude_domains?: string[];
  /** Prefer these domains without excluding others. */
  boost_domains?: string[];
  /** "day" | "week" | "month" | "year" | "YYYY-MM-DDtoYYYY-MM-DD". */
  freshness?: string;
  /** ISO 3166-1 alpha-2 country code, e.g. "US". */
  country?: string;
};

export type ResearchParams = {
  /** The research question, max 40,000 characters. */
  input: string;
  /**
   * lite <10s, standard ~10-30s (default), deep <120s,
   * exhaustive <300s, frontier requires background: true.
   */
  research_effort?: ResearchEffort;
  /** Constrain sources by domain, freshness, or country (beta). */
  source_control?: SourceControl;
  /** Structured output (not supported with lite). */
  output_schema?: Record<string, unknown>;
  /** Queue as a background task and return a handle immediately. */
  background?: boolean;
  [key: string]: unknown;
};

/**
 * POST /v1/research: grounded answers with inline citations.
 * Synchronous unless params.background is true. On Webflow Cloud, keep
 * synchronous calls at lite/standard effort (20 second request ceiling)
 * and use background mode + polling for deep/exhaustive/frontier.
 */
export function research(
  apiKey: string,
  params: ResearchParams & { background: true },
  signal?: AbortSignal,
): Promise<ResearchTask>;
export function research(
  apiKey: string,
  params: ResearchParams,
  signal?: AbortSignal,
): Promise<ResearchOutput>;
export function research(
  apiKey: string,
  params: ResearchParams,
  signal?: AbortSignal,
): Promise<ResearchOutput | ResearchTask> {
  return request("v1/research", apiKey, { body: params, signal });
}

/** GET /v1/research/{task_id}: poll a background task for status/result. */
export function getResearchTask(
  apiKey: string,
  taskId: string,
  signal?: AbortSignal,
): Promise<ResearchTaskDetail> {
  return request(`v1/research/${taskId}`, apiKey, { method: "GET", signal });
}

/**
 * URL (behind this app's proxy) for a task's Server-Sent Events stream.
 * Note Webflow Cloud's 20 second request ceiling also applies to a proxied
 * SSE connection: reconnect with ?from_id=<last event id> to resume.
 */
export function researchTaskStreamPath(taskId: string, fromId = 0): string {
  return `/api/you/v1/research/${taskId}/stream${fromId ? `?from_id=${fromId}` : ""}`;
}

export type FinanceResearchParams = {
  /** The financial research question, max 40,000 characters. */
  input: string;
  /** deep (default, <120s) or exhaustive (<300s). No other levels. */
  research_effort?: "deep" | "exhaustive";
  [key: string]: unknown;
};

/**
 * POST /v1/finance_research: research over a finance-optimized index
 * (fundamentals, prices, SEC filings, analyst coverage, financial news).
 * Same response shape as the Research API, but synchronous only: no
 * background mode, no output_schema, no source_control. On Webflow Cloud,
 * calls can exceed the platform's 20 second request ceiling; handle that
 * failure and offer a Research API background retry.
 */
export function financeResearch(
  apiKey: string,
  params: FinanceResearchParams,
  signal?: AbortSignal,
): Promise<ResearchOutput> {
  return request("v1/finance_research", apiKey, { body: params, signal });
}

/**
 * Defensively extract result objects (anything with a url and a title-like
 * field) from a response whose exact shape may evolve. Replace with exact
 * types once the response contract for your endpoint is confirmed.
 */
export function extractSearchResults(data: unknown): YouSearchResult[] {
  const found: YouSearchResult[] = [];

  const visit = (node: unknown, depth: number): void => {
    if (found.length >= 20 || depth > 5 || node === null || node === undefined)
      return;

    if (Array.isArray(node)) {
      const objects = node.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null && !Array.isArray(item),
      );
      const resultLike = objects.filter(
        (o) =>
          typeof o.url === "string" &&
          (typeof o.title === "string" || typeof o.name === "string"),
      );
      if (resultLike.length > 0) {
        for (const o of resultLike) found.push(o as YouSearchResult);
        return;
      }
      for (const item of node) visit(item, depth + 1);
      return;
    }

    if (typeof node === "object") {
      for (const value of Object.values(node as Record<string, unknown>)) {
        visit(value, depth + 1);
      }
    }
  };

  visit(data, 0);
  return found.slice(0, 20);
}

/** Pull the best available snippet text off a loosely-typed result. */
export function resultSnippet(result: YouSearchResult): string | undefined {
  if (typeof result.description === "string") return result.description;
  if (typeof result.snippet === "string") return result.snippet;
  if (Array.isArray(result.snippets) && typeof result.snippets[0] === "string")
    return result.snippets[0];
  return undefined;
}
