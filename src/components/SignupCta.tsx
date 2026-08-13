import { appConfig } from "@/lib/app-config";

/**
 * Sign-up CTA with UTM attribution so key signups from each demo app are
 * measurable. utm_campaign is the app name from app-config.
 */
export function signupUrl(campaign: string = appConfig.name): string {
  const url = new URL(appConfig.platformUrl);
  url.searchParams.set("utm_source", "oss-demo");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

export function SignupCta({
  label = "Get a free API key",
  className = "btn-primary",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={signupUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {label}
    </a>
  );
}
