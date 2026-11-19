import { ApiKeyGate } from "@/components/ApiKeyGate";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SiteResearchApp } from "@/components/SiteResearchApp";

const STEPS = [
  {
    n: "1",
    title: "Scope it",
    body: "Add one or more domains. source_control.include_domains means the research agent only searches and reads those sites.",
  },
  {
    n: "2",
    title: "Ask it",
    body: "The agent plans searches, reads pages, and cross-references within your scope, using a live index instead of a stale crawl.",
  },
  {
    n: "3",
    title: "Check it",
    body: "A cited answer, a list of the exact pages consulted, and a one-click check of any page: its live text, and whether the cited excerpts are on it.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6">
        <section className="py-10 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            you.com api demo
          </p>
          <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold leading-tight">
            Ask any website anything
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            The classic answer is a RAG pipeline: crawl the site, chunk it,
            embed it, store vectors, answer from stale copies. Here, scoping is
            just a request parameter and the index is live.
          </p>
        </section>

        <section>
          <ApiKeyGate>
            <SiteResearchApp />
          </ApiKeyGate>
        </section>

        <section className="mt-12">
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="card p-5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="card p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Zero-infrastructure site Q&A
            </h3>
            <p className="mt-3 text-sm text-muted">
              One request does what a crawl-chunk-embed-store pipeline does,
              without the pipeline. Constrain by domain with{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-xs">
                include_domains
              </code>
              , by recency with{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-xs">
                freshness
              </code>
              , and every source in the answer is listed so scope is
              verifiable, not vibes.
            </p>
            <pre className="mt-4 overflow-x-auto text-xs leading-6 text-muted">
{`POST /api/you/v1/research
{
  "input": "What are Stripe's current US card processing fees?",
  "research_effort": "standard",
  "source_control": {
    "include_domains": ["stripe.com"],
    "freshness": "year"
  }
}
-> cited answer + the exact pages consulted (all on-scope)`}
            </pre>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
