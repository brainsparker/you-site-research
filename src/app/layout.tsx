import type { Metadata } from "next";
import "./globals.css";
import { ApiKeyProvider } from "@/lib/api-key";
import { appConfig } from "@/lib/app-config";

export const metadata: Metadata = {
  title: appConfig.title,
  description: appConfig.tagline,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface font-sans text-ink antialiased">
        <ApiKeyProvider>{children}</ApiKeyProvider>
      </body>
    </html>
  );
}
