import type { Metadata, Viewport } from "next";
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

export const metadata: Metadata = {
  title: "Micro-Learn | AI-Powered Flash Learning",
  description:
    "Transform any YouTube video or article into interactive flashcards and quizzes using AI",
  manifest: "/manifest.json",
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
      <body className="min-h-screen bg-background text-text-primary antialiased">
        <ErrorBoundary>
          <AuthProvider>
            <LocaleProvider>
              <RTLProvider>
                <SidebarProvider>
                  <OfflineProvider>
                    <OfflineBanner />
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
