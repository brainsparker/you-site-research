"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  extract,
  YouApiError,
  type ResearchSource,
} from "@/lib/you-client";
import {
  checkSnippets,
  isPdfUrl,
  previewParams,
  readExtract,
  truncateMarkdown,
  type PageText,
  type SnippetMatch,
} from "@/lib/page-check";

type Load =
  | { status: "loading" }
  | { status: "done"; page: PageText }
  | { status: "empty" }
  | { status: "error"; message: string; code?: string; retryable: boolean };

const MATCH_LABEL: Record<SnippetMatch, string> = {
  found: "on the page",
  partial: "partly on the page",
  missing: "not found",
};

const MATCH_STYLE: Record<SnippetMatch, string> = {
  found: "border-emerald-700 text-emerald-400",
  partial: "border-edge text-muted",
  missing: "border-amber-700 text-amber-400",
};

function describeError(err: unknown): Extract<Load, { status: "error" }> {
  if (err instanceof YouApiError) {
    let message = err.message;
    if (err.status === 401 || err.status === 403) {
      message = `Your API key was rejected (${err.status}).`;
    } else if (err.code === "timeout" || err.status === 504) {
      message = "The page took too long to extract.";
    } else if (err.code === "pdf_too_large") {
      message = "This PDF is too large to read within the preview's time limit.";
    } else if (err.code === "payment_required" || err.status === 402) {
      message = "Your You.com credit balance is empty. Add credits at you.com/platform.";
    }
    return {
      status: "error",
      message,
      code: err.code,
      // A timeout is worth one more try even when the flag is absent.
      retryable: err.retryable || err.code === "timeout" || err.status === 504,
    };
  }
  return {
    status: "error",
    message:
      "The request did not complete. On the hosted demo this usually means the platform's 20 second window cut it off.",
    retryable: true,
  };
}

/**
 * Reads one consulted page (or PDF) through the Extract API and shows it as
 * rendered Markdown, with a check of whether the excerpts the research agent
 * cited from this source are actually on the page.
 */
export function PagePreview({
  apiKey,
  source,
  onClose,
}: {
  apiKey: string;
  source: ResearchSource;
  onClose: () => void;
}) {
  const [live, setLive] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    extract(apiKey, previewParams(source.url, { live }), controller.signal)
      .then((data) => {
        const page = readExtract(data);
        setLoad(page ? { status: "done", page } : { status: "empty" });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoad(describeError(err));
      });
    return () => controller.abort();
  }, [apiKey, source.url, live, attempt]);

  const page = load.status === "done" ? load.page : null;
  const checks = useMemo(
    () => (page ? checkSnippets(page.markdown, source.snippets) : []),
    [page, source.snippets],
  );
  const shown = useMemo(
    () => (page ? truncateMarkdown(page.markdown) : null),
    [page],
  );
  const foundCount = checks.filter((c) => c.match !== "missing").length;

  function reload(nextLive: boolean) {
    setLoad({ status: "loading" });
    setLive(nextLive);
    setAttempt((n) => n + 1);
  }

  return (
    <div className="mt-4 rounded-lg border border-edge bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {page?.title ?? source.title ?? source.url}
          </p>
          <p className="truncate text-xs text-muted">
            {source.url}
            {isPdfUrl(source.url) ? " (PDF)" : ""}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs text-muted transition hover:text-ink"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {load.status === "loading" && (
        <p className="mt-3 text-xs text-muted">
          {live ? "Fetching the live page..." : "Reading the page..."}
        </p>
      )}

      {load.status === "error" && (
        <div className="mt-3 text-xs">
          <p className="text-amber-400">
            {load.message}
            {load.code ? ` (${load.code})` : ""}
          </p>
          {load.retryable && (
            <button
              type="button"
              className="mt-2 text-muted underline transition hover:text-ink"
              onClick={() => reload(live)}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {load.status === "empty" && (
        <div className="mt-3 text-xs text-muted">
          <p>Nothing could be extracted from this page.</p>
          {!live && (
            <button
              type="button"
              className="mt-2 underline transition hover:text-ink"
              onClick={() => reload(true)}
            >
              Fetch it live
            </button>
          )}
        </div>
      )}

      {page && shown && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>
              {live
                ? "Fetched live just now."
                : "May be a cached copy."}
            </span>
            {!live && (
              <button
                type="button"
                className="underline transition hover:text-ink"
                onClick={() => reload(true)}
              >
                Fetch it live
              </button>
            )}
          </div>

          {checks.length > 0 && (
            <div className="mt-3 border-t border-edge pt-3">
              <p className="text-xs font-medium text-ink">
                {foundCount} of {checks.length} cited excerpt
                {checks.length === 1 ? "" : "s"} found in this page
              </p>
              <ul className="mt-2 space-y-2">
                {checks.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${MATCH_STYLE[c.match]}`}
                    >
                      {MATCH_LABEL[c.match]}
                    </span>
                    <span className="line-clamp-3 text-muted">{c.snippet}</span>
                  </li>
                ))}
              </ul>
              {foundCount < checks.length && (
                <p className="mt-2 text-[11px] text-muted">
                  An excerpt can be missing because the page changed after it
                  was indexed, or because excerpts are trimmed.
                  {live ? "" : " Fetch the page live to compare against the current version."}
                </p>
              )}
            </div>
          )}

          <div className="prose prose-sm prose-invert mt-3 max-h-96 max-w-none overflow-auto border-t border-edge pt-3 prose-a:text-accent prose-a:no-underline hover:prose-a:underline">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: (props) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
                // A preview should not load third-party images.
                img: () => null,
              }}
            >
              {shown.text}
            </ReactMarkdown>
          </div>
          {shown.truncated && (
            <p className="mt-2 text-[11px] text-muted">
              Showing the first {shown.text.length.toLocaleString()} of{" "}
              {page.markdown.length.toLocaleString()} characters. Excerpts are
              checked against the whole page.
            </p>
          )}
        </>
      )}
    </div>
  );
}
