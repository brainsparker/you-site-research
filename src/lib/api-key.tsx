"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * BYOK key handling. The visitor's You.com API key lives in this browser
 * (localStorage) and is attached per request as an x-api-key header to the
 * app's own /api/you proxy route, which forwards it upstream. The key is
 * never stored or logged server-side.
 */
const STORAGE_KEY = "ydc_api_key";

type ApiKeyContextValue = {
  apiKey: string | null;
  /** False until localStorage has been read on the client. */
  ready: boolean;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
};

const ApiKeyContext = createContext<ApiKeyContextValue | null>(null);

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setKeyState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setKeyState(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      // localStorage unavailable (private browsing etc.); key lives in memory only.
    }
    setReady(true);
  }, []);

  const setApiKey = useCallback((key: string) => {
    const trimmed = key.trim();
    setKeyState(trimmed);
    try {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // Ignore: in-memory only.
    }
  }, []);

  const clearApiKey = useCallback(() => {
    setKeyState(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore.
    }
  }, []);

  return (
    <ApiKeyContext.Provider value={{ apiKey, ready, setApiKey, clearApiKey }}>
      {children}
    </ApiKeyContext.Provider>
  );
}

export function useApiKey(): ApiKeyContextValue {
  const ctx = useContext(ApiKeyContext);
  if (!ctx) throw new Error("useApiKey must be used inside <ApiKeyProvider>");
  return ctx;
}
