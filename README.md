# you-site-research

Ask questions of any website and get cited answers drawn only from that site. Zero RAG infrastructure: no crawler, no chunker, no embeddings, no vector database. Domain scoping is a request parameter.

Built on the [You.com Research API](https://you.com/docs/guides/research)'s `source_control`, from [you-app-template](https://github.com/brainsparker/you-app-template), deployable to [Webflow Cloud](https://developers.webflow.com/webflow-cloud/intro).

## Why this exists

The classic "chat with a website" demo is a pipeline: crawl the site, chunk the pages, embed the chunks, store vectors, retrieve, and answer from copies that started going stale the moment they were made. That architecture exists because general web search could not be scoped. Now it can:

```json
POST /v1/research
{
  "input": "What are Stripe's current US card processing fees?",
  "research_effort": "standard",
  "source_control": {
    "include_domains": ["stripe.com"],
    "freshness": "year"
  }
}
```

The research agent plans searches, reads pages, and synthesizes an answer while only touching the domains you allow. The response lists every page consulted, and this app badges any source that falls outside your scope, so the constraint is verifiable rather than taken on faith.

- **Live, not stale**: answers come from the live index, not last month's crawl
- **Scope you can check**: every source is listed with an on-list/off-list badge
- **Check the page**: one click reads any consulted page or PDF through the [Extract API](https://you.com/docs/guides/extract), renders it as Markdown, and marks which of the excerpts the agent cited are actually on it
- **Live when it matters**: "Fetch it live" re-reads the page with `extraction_source: "fetch"`, so you compare the answer against the page as it is now, not a cached copy
- **One key, BYOK**: the visitor's You.com key stays in their browser

## Quickstart (local)

```bash
git clone https://github.com/brainsparker/you-site-research.git
cd you-site-research
npm install
npm run dev
```

Open http://localhost:3000, paste your You.com API key, try an example, or point it at your own docs.

No key yet? Create one at [you.com/platform](https://you.com/platform). New accounts include $100 in API credits.

## The source_control contract

| Field | Type | Notes |
| --- | --- | --- |
| `include_domains` | string[] | Only these domains (max 500). Cannot combine with `exclude_domains` or `boost_domains` |
| `exclude_domains` | string[] | Never these domains; also blocks the agent from browsing them (max 500) |
| `boost_domains` | string[] | Prefer without excluding others (max 500). Cannot combine with `include_domains` |
| `freshness` | string | `day`, `week`, `month`, `year`, or `YYYY-MM-DDtoYYYY-MM-DD` |
| `country` | string | ISO 3166-1 alpha-2, e.g. `US` |

`source_control` is a Research API feature (the Finance Research API does not support it) and works alongside `output_schema` and background mode.

## Effort levels and the 20-second window

Fast (`lite`, <10s) and Standard (`standard`, ~10-30s) run synchronously. Deep runs as a background task with polling, so it never fights hosted platforms' 20 second request ceiling. When a synchronous call does get cut on the hosted demo, the error offers a one-click retry as a background deep task; the pattern is documented in depth in [you-deep-research](https://github.com/brainsparker/you-deep-research).

Key files:

| File | Purpose |
| --- | --- |
| `src/components/SiteResearchApp.tsx` | Domain chips, effort/freshness controls, scope badges |
| `src/components/PagePreview.tsx` | The check panel: Extract call, rendered page, cited-excerpt check, live refetch, typed errors |
| `src/lib/page-check.ts` | Pure helpers: preview request params, response reading, excerpt matching |
| `src/components/Markdown.tsx` | Cited markdown rendering (handles `[[1]]` and `[[1, 2]]` groups) |
| `src/lib/you-client.ts` | Typed Research and Extract clients, including `SourceControl` and error `code`/`retryable` |
| `src/app/api/you/[...path]/route.ts` | Locked-down proxy with per-request key forwarding; routes `v1/extract` to `ydc-index.io` |

## Checking a page with the Extract API

Every consulted page has a "check" link. It sends one request:

```json
POST /v1/extract
{
  "url": "https://stripe.com/pricing",
  "timeout": 15
}
```

and reads the page from `contents.full_page.markdown`. Three things are worth copying:

| Choice | Why |
| --- | --- |
| `timeout: 15` | Caps the whole request under the hosted 20 second window, so a slow page returns a typed `timeout` error instead of a cut connection |
| `extraction_source: "fetch"` on "Fetch it live" | The default (`blend`) may serve a cached copy. `fetch` always crawls, which is what you want when checking a price or a policy |
| `parse_effort: "lite"` for `.pdf` URLs | Reads the PDF's embedded text with no per-page charge, enough for a preview |

Errors carry a stable `code` and a `retryable` flag ([reference](https://you.com/docs/api-reference/extract)), surfaced on `YouApiError`. The panel offers "Try again" only when the API says a retry can work. A `200` with no `contents` means nothing was extracted, so check before reading.

The excerpt check compares each `sources[].snippets` entry with the page text after stripping Markdown, punctuation, and case. "On the page" means the whole excerpt matched, "partly on the page" means a run of 8 consecutive words matched (excerpts are often trimmed), and "not found" means neither did. It is a quick signal, not proof: a miss can also mean the page changed after it was indexed.

Extract replaces the Contents API, which You.com deprecated on 2026-11-16. Pricing is $0.90 per 1,000 URLs. The `contents()` client function and the `v1/contents` proxy path are still here for forks that call them, marked deprecated.

## Deploy to Webflow Cloud

1. Fork this repo and push to GitHub.
2. `webflow cloud init`: authenticate, pick your site, choose a mount path (for example `/demos/site-research`).
3. `webflow cloud deploy`. Every push to the tracked branch auto-deploys after that.

Do not add `export const runtime = "edge"` to route handlers: Webflow Cloud builds with OpenNext, which rejects edge-runtime routes.

## Replicate this

1. Start from [you-app-template](https://github.com/brainsparker/you-app-template).
2. Normalize user input into bare domains (see `normalizeDomain`) and pass them as `source_control.include_domains`.
3. Render the answer with citations linked to `output.sources`, and badge any off-scope source; trust the constraint because you can see it holding.
4. Use the Extract API to read any consulted page, and check the cited excerpts against it (see `page-check.ts`).

## License

MIT. See [LICENSE](./LICENSE).
