export const supportedLocales = [
  "en", "ar", "tr", "es", "fr", "de", "zh", "ja", "ko", "hi", "ur", "pt", "ru", "id",
] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const rtlLocales: SupportedLocale[] = ["ar", "ur"];

export function isRTL(locale: string): boolean {
  return rtlLocales.includes(locale as SupportedLocale);
}

export function getDirection(locale: string): "rtl" | "ltr" {
  return isRTL(locale) ? "rtl" : "ltr";
}

export function getFont(locale: string): string {
  switch (locale) {
    case "ar":
    case "ur":
      return "'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif";
    case "zh":
      return "'Noto Sans SC', 'PingFang SC', sans-serif";
    case "ja":
      return "'Noto Sans JP', 'Hiragino Sans', sans-serif";
    case "ko":
      return "'Noto Sans KR', 'Malgun Gothic', sans-serif";
    case "hi":
      return "'Noto Sans Devanagari', sans-serif";
    default:
      return "'Inter', 'SF Pro Display', system-ui, sans-serif";
  }
}
