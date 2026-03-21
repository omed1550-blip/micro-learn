"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles, LogOut, Plus, Layers, Flame, Home } from "lucide-react";
import { getModules, getDecks, getDashboard, LearningModuleListItem, ManualDeck, DashboardData } from "@/lib/api";
import { useSidebar } from "@/lib/SidebarContext";
import { useLocale } from "@/lib/LocaleContext";
import { useOffline } from "@/lib/OfflineContext";
import { useSession, signOut } from "next-auth/react";
import { offlineStorage } from "@/lib/offlineStorage";
import { getSourceIcon, getSourceColor } from "@/lib/sourceIcons";
import LanguagePicker from "./LanguagePicker";
import CreateDeckModal from "./CreateDeckModal";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

interface Props {
  onNewModule: () => void;
  refreshKey?: number;
}

export default function Sidebar({ onNewModule, refreshKey }: Props) {
  const { isOpen, toggle, close } = useSidebar();
  const { t, direction } = useLocale();
  const { isOnline, pendingSync, syncNow } = useOffline();
  const { data: session } = useSession();
  const pathname = usePathname();
  const [modules, setModules] = useState<LearningModuleListItem[]>([]);
  const [decks, setDecks] = useState<ManualDeck[]>([]);
  const [showCreateDeck, setShowCreateDeck] = useState(false);
  const [activity, setActivity] = useState<DashboardData | null>(null);
  const isRTL = direction === "rtl";

  useEffect(() => {
    if (!session?.accessToken) return;
    getModules()
      .then(setModules)
      .catch(async () => {
        try {
          const cached = await offlineStorage.getAllModules();
          if (cached.length > 0) setModules(cached);
        } catch {}
      });
    getDecks().then(setDecks).catch(() => {});
    getDashboard().then(setActivity).catch(() => {});
  }, [refreshKey, session?.accessToken]);

  const activeModuleId = pathname.startsWith("/learn/")
    ? pathname.split("/learn/")[1]
    : null;
  const activeDeckId = pathname.startsWith("/decks/")
    ? pathname.split("/decks/")[1]
    : null;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <span className="text-primary text-lg tracking-tight font-[800]">
          {t("common.appName")}
        </span>
        <button
          onClick={toggle}
          className="text-text-secondary hover:text-text-primary transition-colors p-1"
        >
          {isRTL ? (
            isOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />
          ) : (
            isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />
          )}
        </button>
      </div>

      {/* Home + New Module */}
      <div className="p-3 space-y-2">
        <Link
          href="/"
          onClick={() => {
            if (typeof window !== "undefined" && window.innerWidth < 768) close();
          }}
        >
          <div
            className={`rounded-xl px-3 py-2.5 transition-colors cursor-pointer flex items-center gap-2 ${
              pathname === "/" ? "bg-primary/15 text-primary" : "hover:bg-surface-hover text-text-secondary"
            }`}
          >
            <Home size={16} />
            <span className="text-sm font-[700]">{t("nav.home")}</span>
          </div>
        </Link>
        <button
          onClick={onNewModule}
          className="w-full bg-primary hover:bg-primary-hover text-white font-[700] py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-[0.97] transition-transform duration-100"
        >
          {t("sidebar.newModule")}
        </button>
      </div>

      {/* Streak Widget */}
      {activity && (
        <Link href="/activity" onClick={() => { if (typeof window !== "undefined" && window.innerWidth < 768) close(); }}>
          <div className="mx-3 mb-2 bg-background rounded-xl px-3 py-2.5 flex items-center gap-2 hover:bg-surface-hover transition-colors cursor-pointer">
            <Flame size={18} className={activity.streak > 0 ? "text-orange-400" : "text-text-muted"} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-[700] text-text-primary">
                {activity.streak > 0
                  ? t("activity.daysStreak").replace("{count}", String(activity.streak))
                  : t("activity.startStreak")}
              </p>
              <div className="w-full h-1.5 bg-surface rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${activity.daily_goal_met ? "bg-success" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, Math.round((activity.daily_xp / (activity.daily_goal || 50)) * 100))}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-text-muted shrink-0">
              {activity.daily_xp || 0}/{activity.daily_goal || 50}
            </span>
          </div>
        </Link>
      )}

      {/* Module List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-none">
        {modules.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles size={24} className="text-text-muted mx-auto mb-2" />
            <p className="text-text-muted text-sm">{t("sidebar.noModules")}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {modules.map((mod) => {
              const Icon = getSourceIcon(mod.source_type);
              const color = getSourceColor(mod.source_type);
              const isActive = activeModuleId === mod.id;
              return (
                <Link
                  key={mod.id}
                  href={`/learn/${mod.id}`}
                  onClick={() => {
                    if (typeof window !== "undefined" && window.innerWidth < 768) close();
                  }}
                >
                  <div
                    className={`rounded-lg px-3 py-2.5 transition-colors cursor-pointer ${
                      isActive
                        ? "bg-primary/15 border-s-[3px] border-primary"
                        : "hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon size={12} className={color} />
                      <span className="text-text-muted text-[10px]">
                        {t(`sources.${mod.source_type}`)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {mod.title}
                    </p>
                    <p className="text-text-muted text-[10px] mt-0.5">
                      {timeAgo(mod.created_at)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Decks */}
      <div className="px-2 pb-2">
        <div className="border-t border-border my-2" />
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            {t("manualDeck.myDecks")}
          </span>
          <button
            onClick={() => setShowCreateDeck(true)}
            className="text-text-muted hover:text-primary transition-colors p-0.5"
          >
            <Plus size={14} />
          </button>
        </div>
        {decks.length > 0 && (
          <div className="space-y-0.5">
            {decks.map((deck) => {
              const isActive = activeDeckId === deck.id;
              return (
                <Link
                  key={deck.id}
                  href={`/decks/${deck.id}`}
                  onClick={() => {
                    if (typeof window !== "undefined" && window.innerWidth < 768) close();
                  }}
                >
                  <div
                    className={`rounded-lg px-3 py-2 transition-colors cursor-pointer ${
                      isActive
                        ? "bg-primary/15 border-s-[3px] border-primary"
                        : "hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: deck.color || "#6366F1" }}
                      />
                      <p className="text-sm font-semibold text-text-primary truncate flex-1">
                        {deck.title}
                      </p>
                      <span className="text-[10px] text-text-muted shrink-0">
                        {deck.card_count}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {decks.length === 0 && (
          <button
            onClick={() => setShowCreateDeck(true)}
            className="w-full text-center py-3 text-text-muted text-xs hover:text-primary transition-colors"
          >
            <Layers size={16} className="mx-auto mb-1" />
            {t("manualDeck.createDeck")}
          </button>
        )}
      </div>

      <CreateDeckModal
        isOpen={showCreateDeck}
        onClose={() => setShowCreateDeck(false)}
        onDeckCreated={() => getDecks().then(setDecks).catch(() => {})}
      />

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-2">
        {session?.user && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
              {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">
                {session.user.name || session.user.email}
              </p>
              {session.user.name && (
                <p className="text-[10px] text-text-muted truncate">{session.user.email}</p>
              )}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="text-text-muted hover:text-text-primary transition-colors p-1"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
        <button
          onClick={!isOnline ? undefined : syncNow}
          className="flex items-center gap-2 w-full px-2 py-1 rounded-lg hover:bg-surface-hover transition-colors text-xs"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? "bg-success" : "bg-warning"}`} />
          <span className="text-text-muted">
            {isOnline ? t("offline.online") : t("offline.offlineLabel")}
          </span>
          {pendingSync > 0 && (
            <span className="text-warning text-[10px] ms-auto">
              ({t("offline.pendingSync", { count: pendingSync })})
            </span>
          )}
        </button>
        <LanguagePicker compact />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={close}
            />
            <motion.aside
              initial={{ x: isRTL ? 280 : -280 }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? 280 : -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`fixed top-0 ${isRTL ? "right-0" : "left-0"} bottom-0 w-[280px] bg-surface border-e border-border z-40 flex flex-col`}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
