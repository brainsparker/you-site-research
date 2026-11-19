"use client";

import { useEffect, useRef, useState } from "react";
import { useApiKey } from "@/lib/api-key";
import {
  getResearchTask,
  research,
  YouApiError,
  type ResearchParams,
  type ResearchSource,
} from "@/lib/you-client";
import { CitedMarkdown } from "./Markdown";
import { PagePreview } from "./PagePreview";

type Effort = "lite" | "standard" | "deep";

const EFFORTS: Array<{ value: Effort; label: string; hint: string }> = [
  { value: "lite", label: "Fast", hint: "<10s, about $0.012/request" },
  { value: "standard", label: "Standard", hint: "~10-30s, about $0.05/request" },
  {
    value: "deep",
    label: "Deep",
    hint: "background task, <120s, about $0.10/request",
  },
];

const FRESHNESS = [
  { value: "", label: "Any time" },
  { value: "day", label: "Past day" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
  { value: "year", label: "Past year" },
];

const EXAMPLES: Array<{ domains: string[]; question: string }> = [
  {
    domains: ["stripe.com"],
    question:
      "What are Stripe's current standard processing fees for US online card payments?",
  },
  {
    domains: ["nextjs.org"],
    question: "How do I configure a basePath, and what are the gotchas?",
  },
  {
    domains: ["you.com"],
    question:
      "What APIs does You.com offer, and how is the Research API priced?",
  },
];

export function normalizeDomain(raw: string): string | null {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split(/[/?#]/)[0];
  d = d.replace(/^www\./, "");
  d = d.replace(/:\d+$/, "");
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(d)) return null;
  return d;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isOnList(url: string, domains: string[]): boolean {
  const host = hostnameOf(url);
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

function ElapsedSince({ start }: { start: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="tabular-nums">
      {Math.max(0, (now - start) / 1000).toFixed(1)}s
    </span>
  );
}

export function SiteResearchApp() {
  const { apiKey, clearApiKey } = useApiKey();
  const [domains, setDomains] = useState<string[]>([]);
  const [domainDraft, setDomainDraft] = useState("");
  const [question, setQuestion] = useState("");
  const [freshness, setFreshness] = useState("");
  const [effort, setEffort] = useState<Effort>("standard");
  const [phase, setPhase] = useState<"idle" | "working" | "done">("idle");
  const [statusNote, setStatusNote] = useState("");
  const [workStart, setWorkStart] = useState(0);
  const [answer, setAnswer] = useState<{
    content: string;
    sources: ResearchSource[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [likelyTimeout, setLikelyTimeout] = useState(false);
  const [preview, setPreview] = useState<ResearchSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  function addDomain(raw: string) {
    const d = normalizeDomain(raw);
    if (!d) {
      setError(`"${raw.trim()}" does not look like a domain.`);
      return;
    }
    setError(null);
    setDomains((ds) => (ds.includes(d) ? ds : [...ds, d]));
    setDomainDraft("");
  }

  function buildParams(runEffort: Effort): ResearchParams {
    return {
      input: question.trim(),
      research_effort: runEffort,
      source_control: {
        include_domains: domains,
        ...(freshness ? { freshness } : {}),
      },
      ...(runEffort === "deep" ? { background: true as const } : {}),
    };
  }

  async function run(runEffort: Effort) {
    if (!apiKey || domains.length === 0 || !question.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("working");
    setWorkStart(Date.now());
    setStatusNote(runEffort === "deep" ? "submitting task" : "researching");
    setError(null);
    setLikelyTimeout(false);
    setAnswer(null);
    setPreview(null);

    try {
      if (runEffort !== "deep") {
        const out = await research(apiKey, buildParams(runEffort), controller.signal);
        setAnswer({
          content:
            typeof out.output.content === "string"
              ? out.output.content
              : JSON.stringify(out.output.content, null, 2),
          sources: out.output.sources ?? [],
        });
        setPhase("done");
        return;
      }

      const task = await research(
        apiKey,
        buildParams("deep") as ResearchParams & { background: true },
        controller.signal,
      );
      for (;;) {
        if (controller.signal.aborted) return;
        const detail = await getResearchTask(apiKey, task.task_id, controller.signal);
        setStatusNote(detail.status);
        if (detail.status === "completed" && detail.result) {
          const out = detail.result;
          setAnswer({
            content:
              typeof out.output.content === "string"
                ? out.output.content
                : JSON.stringify(out.output.content, null, 2),
            sources: out.output.sources ?? [],
          });
          setPhase("done");
          return;
        }
        if (detail.status === "failed" || detail.status === "cancelled") {
          setError(detail.error ?? `Task ${detail.status}.`);
          setPhase("idle");
          return;
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof YouApiError && err.status === 401) {
        setError("Your API key was rejected (401). Remove it and add a valid key.");
      } else if (err instanceof YouApiError) {
        setError(`The API rejected the request (${err.status}): ${err.message}`);
      } else {
        setError(
          "The request did not complete. On the hosted demo this usually means the platform's 20 second window cut it off.",
        );
        setLikelyTimeout(true);
      }
      setPhase("idle");
    }
  }

  const ready = domains.length > 0 && question.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-2">
          {domains.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-xs"
            >
              {d}
              <button
                type="button"
                className="text-muted transition hover:text-red-400"
                onClick={() => setDomains((ds) => ds.filter((x) => x !== d))}
                disabled={phase === "working"}
                aria-label={`Remove ${d}`}
              >
                x
              </button>
            </span>
          ))}
          <input
            className="input max-w-60 flex-1"
            placeholder="Add a domain, e.g. stripe.com"
            value={domainDraft}
            onChange={(e) => setDomainDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDomain(domainDraft);
              }
            }}
            disabled={phase === "working"}
          />
          <button
            type="button"
            className="btn-ghost shrink-0 text-xs"
            onClick={() => addDomain(domainDraft)}
            disabled={phase === "working" || !domainDraft.trim()}
          >
            Add domain
          </button>
        </div>

        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(effort);
          }}
        >
          <textarea
            className="input min-h-16 resize-y"
            placeholder="What do you want to know from these sites?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={phase === "working"}
            rows={2}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-edge p-0.5">
              {EFFORTS.map((ef) => (
                <button
                  key={ef.value}
                  type="button"
                  title={ef.hint}
                  onClick={() => setEffort(ef.value)}
                  disabled={phase === "working"}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    effort === ef.value
                      ? "bg-accent text-white"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {ef.label}
                </button>
              ))}
            </div>
            <select
              className="input w-auto"
              value={freshness}
              onChange={(e) => setFreshness(e.target.value)}
              disabled={phase === "working"}
              aria-label="Freshness"
            >
              {FRESHNESS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="btn-primary ml-auto"
              disabled={phase === "working" || !ready}
            >
              Research this site
            </button>
          </div>
        </form>

        {phase === "idle" && !answer && (
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.question}
                type="button"
                onClick={() => {
                  setDomains(ex.domains);
                  setQuestion(ex.question);
                }}
                className="rounded-full border border-edge px-3 py-1 text-xs text-muted transition hover:border-accent hover:text-ink"
              >
                {ex.domains[0]}: {ex.question.slice(0, 44)}...
              </button>
            ))}
          </div>
        )}

        {ready && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted transition hover:text-ink">
              View the API request
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface p-3 text-xs text-muted">
              {`POST /v1/research\n${JSON.stringify(buildParams(effort), null, 2)}`}
            </pre>
          </details>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-300">
          {error}{" "}
          {error.includes("401") && (
            <button
              type="button"
              onClick={clearApiKey}
              className="underline transition hover:text-red-100"
            >
              Remove saved key
            </button>
          )}
          {likelyTimeout && (
            <button
              type="button"
              className="ml-2 underline transition hover:text-red-100"
              onClick={() => {
                setEffort("deep");
                void run("deep");
              }}
            >
              Retry as a background deep task
            </button>
          )}
        </div>
      )}

      {phase === "working" && (
        <div className="card flex items-center justify-between p-5 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            <span className="font-medium">
              Researching within {domains.join(", ")}
            </span>
            <span className="text-muted">
              <ElapsedSince start={workStart} />
            </span>
            <span className="rounded-full border border-edge px-2 py-0.5 text-[11px] text-muted">
              {statusNote}
            </span>
          </div>
          <button
            type="button"
            className="text-xs text-muted transition hover:text-ink"
            onClick={() => {
              abortRef.current?.abort();
              setPhase("idle");
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {phase === "done" && answer && (
        <div className="card p-6">
          <CitedMarkdown content={answer.content} sources={answer.sources} />

          {answer.sources.length > 0 && (
            <div className="mt-6 border-t border-edge pt-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Pages consulted
              </h4>
              <ol className="mt-3 space-y-2">
                {answer.sources.map((s, i) => {
                  const onList = isOnList(s.url, domains);
                  return (
                    <li
                      key={`${s.url}-${i}`}
                      className="flex flex-wrap items-center gap-2 text-xs"
                    >
                      <span className="text-muted">[{i + 1}]</span>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent transition hover:underline"
                      >
                        {s.title || s.url}
                      </a>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          onList
                            ? "border-edge text-muted"
                            : "border-amber-700 text-amber-400"
                        }`}
                      >
                        {onList ? hostnameOf(s.url) : "off-list source"}
                      </span>
                      <button
                        type="button"
                        className="text-muted underline transition hover:text-ink"
                        onClick={() => setPreview(s)}
                      >
                        check
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {preview && apiKey && (
            <PagePreview
              // Remount per source so each one starts from a fresh read.
              key={preview.url}
              apiKey={apiKey}
              source={preview}
              onClose={() => setPreview(null)}
            />
          )}

          <div className="mt-4 text-center">
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => {
                setPhase("idle");
                setAnswer(null);
                setQuestion("");
              }}
            >
              New question
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
