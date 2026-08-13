"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ResearchSource } from "@/lib/you-client";

/**
 * Link inline citations to their source URLs before rendering.
 * Handles both single [[1]] and grouped [[1, 2]] citation forms.
 */
export function linkCitations(
  content: string,
  sources: ResearchSource[],
): string {
  return content.replace(/\[\[([\d\s,]+)\]\]/g, (match, group: string) => {
    const nums = group
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
    if (nums.length === 0) return match;
    return nums
      .map((n) => {
        const source = sources[n - 1];
        return source?.url ? `[\\[${n}\\]](${source.url})` : `\\[${n}\\]`;
      })
      .join(" ");
  });
}

export function CitedMarkdown({
  content,
  sources,
}: {
  content: string;
  sources: ResearchSource[];
}) {
  return (
    <div className="prose prose-sm prose-invert max-w-none prose-a:text-accent prose-a:no-underline hover:prose-a:underline">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {linkCitations(content, sources)}
      </ReactMarkdown>
    </div>
  );
}

export function SourceList({
  sources,
  defaultOpen = false,
}: {
  sources: ResearchSource[];
  defaultOpen?: boolean;
}) {
  if (sources.length === 0) return null;
  return (
    <details className="mt-3 border-t border-edge pt-2" open={defaultOpen}>
      <summary className="cursor-pointer text-xs font-medium text-muted transition hover:text-ink">
        {sources.length} source{sources.length === 1 ? "" : "s"}
      </summary>
      <ol className="mt-2 space-y-2">
        {sources.map((s, i) => (
          <li key={`${s.url}-${i}`} className="text-xs">
            <span className="mr-1.5 text-muted">[{i + 1}]</span>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent transition hover:underline"
            >
              {s.title || s.url}
            </a>
            {s.snippets?.[0] && (
              <p className="mt-0.5 line-clamp-2 pl-6 text-muted">
                {s.snippets[0]}
              </p>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}
