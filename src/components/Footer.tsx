import { appConfig } from "@/lib/app-config";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-edge">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted">
        <span>
          MIT licensed. Built on the{" "}
          <a
            href="https://you.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition hover:text-ink"
          >
            You.com API
          </a>
          . Deployed on Webflow Cloud.
        </span>
        <a
          href={appConfig.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline transition hover:text-ink"
        >
          View source
        </a>
      </div>
    </footer>
  );
}
