import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { LocaleProvider } from "@/lib/LocaleContext";
import { SidebarProvider } from "@/lib/SidebarContext";
import RTLProvider from "@/components/RTLProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import { OfflineProvider } from "@/lib/OfflineContext";
import OfflineBanner from "@/components/OfflineBanner";
import AppShell from "@/components/AppShell";
import AuthProvider from "@/lib/AuthProvider";
import AuthGuard from "@/components/AuthGuard";
import { XPProvider } from "@/lib/XPContext";
import XPPopup from "@/components/XPPopup";
import LevelUpModal from "@/components/LevelUpModal";
import AchievementUnlock from "@/components/AchievementUnlock";
import EmailVerifyBanner from "@/components/EmailVerifyBanner";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  title: "Micro-Learn | AI-Powered Flash Learning",
  description:
    "Transform any YouTube video, article, or document into interactive flashcards and quizzes. Powered by AI with spaced repetition for maximum retention.",
  manifest: "/manifest.json",
  openGraph: {
    title: "Micro-Learn | AI-Powered Flash Learning",
    description: "Transform any YouTube video, article, or document into interactive flashcards and quizzes. Powered by AI with spaced repetition for maximum retention.",
    type: "website",
    siteName: "Micro-Learn",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Micro-Learn | AI-Powered Flash Learning",
    description: "Transform any YouTube video, article, or document into interactive flashcards and quizzes. Powered by AI with spaced repetition for maximum retention.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#6366F1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
      <body className="min-h-screen bg-background text-text-primary antialiased">
        <ErrorBoundary>
          <AuthProvider>
            <LocaleProvider>
              <RTLProvider>
                <SidebarProvider>
                  <OfflineProvider>
                    <OfflineBanner />
                    <EmailVerifyBanner />
                    <AuthGuard>
                      <XPProvider>
                        <XPPopup />
                        <LevelUpModal />
                        <AchievementUnlock />
                        <AppShell>{children}</AppShell>
                      </XPProvider>
                    </AuthGuard>
                  </OfflineProvider>
                </SidebarProvider>
              </RTLProvider>
            </LocaleProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
