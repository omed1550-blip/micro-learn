"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { supportedLocales, SupportedLocale, getDirection } from "./i18n";

// Import all message files statically
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import tr from "@/messages/tr.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import zh from "@/messages/zh.json";
import ja from "@/messages/ja.json";
import ko from "@/messages/ko.json";
import hi from "@/messages/hi.json";
import ur from "@/messages/ur.json";
import pt from "@/messages/pt.json";
import ru from "@/messages/ru.json";
import id from "@/messages/id.json";

type Messages = typeof en;

const allMessages: Record<SupportedLocale, Messages> = {
  en, ar, tr, es, fr, de, zh, ja, ko, hi, ur, pt, ru, id,
};

interface LocaleContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  direction: "rtl" | "ltr";
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function detectBrowserLocale(): SupportedLocale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language?.toLowerCase() ?? "";
  // Exact match
  const exact = supportedLocales.find((l) => lang === l || lang.startsWith(l + "-"));
  if (exact) return exact;
  // Prefix match
  const prefix = lang.split("-")[0];
  const match = supportedLocales.find((l) => l === prefix);
  return match ?? "en";
}

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("micro-learn-locale") as SupportedLocale | null;
    if (stored && supportedLocales.includes(stored)) {
      setLocaleState(stored);
    } else {
      setLocaleState(detectBrowserLocale());
    }
    setHydrated(true);
  }, []);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    localStorage.setItem("micro-learn-locale", newLocale);
  }, []);

  const direction = getDirection(locale);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value =
        getNestedValue(allMessages[locale] as unknown as Record<string, unknown>, key) ??
        getNestedValue(allMessages.en as unknown as Record<string, unknown>, key) ??
        key;

      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return value;
    },
    [locale]
  );

  // Prevent flash of wrong locale on hydration
  if (!hydrated) {
    return null;
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, direction, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
