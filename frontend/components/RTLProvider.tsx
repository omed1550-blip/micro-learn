"use client";

import { useEffect, ReactNode } from "react";
import { useLocale } from "@/lib/LocaleContext";
import { getFont } from "@/lib/i18n";

export default function RTLProvider({ children }: { children: ReactNode }) {
  const { locale, direction } = useLocale();

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = locale;
    document.documentElement.style.fontFamily = getFont(locale);
  }, [locale, direction]);

  return <>{children}</>;
}
