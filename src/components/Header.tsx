"use client";

import { appConfig } from "@/lib/app-config";
import { ApiKeyChip } from "./ApiKeyGate";
import { SignupCta } from "./SignupCta";

export function Header() {
  return (
    <header className="border-b border-edge">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-lg font-bold text-transparent">
            you.com
          </span>
          <span className="text-muted">/</span>
          <span className="text-sm font-medium">{appConfig.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <ApiKeyChip />
          <a
            href={appConfig.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted transition hover:text-ink"
          >
            GitHub
          </a>
          <SignupCta />
        </div>
      </div>
    </header>
  );
}
