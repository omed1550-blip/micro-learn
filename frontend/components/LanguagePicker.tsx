"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale } from "@/lib/LocaleContext";
import { SupportedLocale } from "@/lib/i18n";

interface LangOption {
  code: SupportedLocale;
  flag: string;
  native: string;
  english: string;
}

const languages: LangOption[] = [
  { code: "en", flag: "\u{1F1FA}\u{1F1F8}", native: "English", english: "English" },
  { code: "ar", flag: "\u{1F1F8}\u{1F1E6}", native: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", english: "Arabic" },
  { code: "tr", flag: "\u{1F1F9}\u{1F1F7}", native: "T\u00FCrk\u00E7e", english: "Turkish" },
  { code: "es", flag: "\u{1F1EA}\u{1F1F8}", native: "Espa\u00F1ol", english: "Spanish" },
  { code: "fr", flag: "\u{1F1EB}\u{1F1F7}", native: "Fran\u00E7ais", english: "French" },
  { code: "de", flag: "\u{1F1E9}\u{1F1EA}", native: "Deutsch", english: "German" },
  { code: "zh", flag: "\u{1F1E8}\u{1F1F3}", native: "\u4E2D\u6587", english: "Chinese" },
  { code: "ja", flag: "\u{1F1EF}\u{1F1F5}", native: "\u65E5\u672C\u8A9E", english: "Japanese" },
  { code: "ko", flag: "\u{1F1F0}\u{1F1F7}", native: "\uD55C\uAD6D\uC5B4", english: "Korean" },
  { code: "hi", flag: "\u{1F1EE}\u{1F1F3}", native: "\u0939\u093F\u0928\u094D\u0926\u0940", english: "Hindi" },
  { code: "ur", flag: "\u{1F1F5}\u{1F1F0}", native: "\u0627\u0631\u062F\u0648", english: "Urdu" },
  { code: "pt", flag: "\u{1F1E7}\u{1F1F7}", native: "Portugu\u00EAs", english: "Portuguese" },
  { code: "ru", flag: "\u{1F1F7}\u{1F1FA}", native: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439", english: "Russian" },
  { code: "id", flag: "\u{1F1EE}\u{1F1E9}", native: "Bahasa", english: "Indonesian" },
];

interface Props {
  compact?: boolean;
}

export default function LanguagePicker({ compact }: Props) {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const current = languages.find((l) => l.code === locale) ?? languages[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = languages.filter(
    (l) =>
      l.native.toLowerCase().includes(search.toLowerCase()) ||
      l.english.toLowerCase().includes(search.toLowerCase()) ||
      l.code.includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setSearch(""); }}
        className="glass rounded-lg px-2.5 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5"
      >
        <span>{current.flag}</span>
        <span className="uppercase text-xs font-bold">{current.code}</span>
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 glass rounded-xl shadow-xl z-50 w-64 overflow-hidden">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              autoFocus
              className="w-full bg-surface rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none"
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filtered.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setLocale(lang.code);
                  setOpen(false);
                }}
                className={`w-full text-start px-4 py-2.5 flex items-center gap-3 hover:bg-surface-hover transition-colors ${
                  lang.code === locale ? "bg-primary/20" : ""
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <div className={compact ? "" : ""}>
                  <p className="text-sm font-bold text-text-primary">{lang.native}</p>
                  <p className="text-xs text-text-muted">{lang.english}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
