"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { getModules, LearningModuleListItem } from "@/lib/api";
import { getSourceIcon, getSourceColor } from "@/lib/sourceIcons";
import { useLocale } from "@/lib/LocaleContext";
import PageTransition from "@/components/PageTransition";
import Skeleton from "@/components/Skeleton";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ModulesPage() {
  const { t } = useLocale();
  const [modules, setModules] = useState<LearningModuleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pull to refresh
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);

  const fetchModules = useCallback(async () => {
    try {
      const mods = await getModules();
      setModules(mods);
    } catch {}
  }, []);

  useEffect(() => {
    fetchModules().finally(() => setLoading(false));
  }, [fetchModules]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startY.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && containerRef.current && containerRef.current.scrollTop === 0) {
      setPullDistance(Math.min(dy * 0.5, 80));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60) {
      setRefreshing(true);
      await fetchModules();
      setRefreshing(false);
    }
    setPullDistance(0);
    startY.current = 0;
  };

  return (
    <PageTransition>
      <div
        ref={containerRef}
        className="min-h-screen px-4 sm:px-6 py-6 sm:py-8 max-w-4xl lg:max-w-5xl mx-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull to refresh indicator */}
        {(pullDistance > 0 || refreshing) && (
          <div
            className="flex justify-center mb-4 transition-all"
            style={{ height: refreshing ? 40 : pullDistance }}
          >
            <Loader2
              size={20}
              className={`text-primary ${refreshing ? "animate-spin" : ""}`}
              style={{ opacity: Math.min(pullDistance / 60, 1) }}
            />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Link
            href="/"
            className="text-text-secondary hover:text-text-primary transition-colors active:scale-95 transition-transform duration-100"
            aria-label={t("common.back")}
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl sm:text-2xl tracking-tight">{t("modules.title")}</h1>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass rounded-xl p-5">
                <Skeleton height="20px" width="70%" className="mb-3" />
                <Skeleton height="14px" width="100%" className="mb-2" />
                <Skeleton height="14px" width="60%" className="mb-3" />
                <Skeleton height="12px" width="40px" />
              </div>
            ))}
          </div>
        ) : modules.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Sparkles size={40} className="text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary mb-2">{t("modules.empty")}</p>
            <Link
              href="/"
              className="inline-block bg-primary hover:bg-primary-hover text-white font-bold py-2.5 px-6 rounded-xl transition-colors active:scale-95 transition-transform duration-100 mt-4"
            >
              {t("modules.goHome")}
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {modules.map((mod, i) => (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/learn/${mod.id}`}>
                  <div className="glass rounded-xl p-4 sm:p-5 hover:bg-surface-hover transition-colors cursor-pointer active:scale-[0.98] transition-transform duration-100">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-text-primary leading-tight line-clamp-1 flex-1 me-3">
                        {mod.title}
                      </h3>
                      <span className="flex items-center gap-1 text-xs text-text-muted shrink-0">
                        {(() => { const Icon = getSourceIcon(mod.source_type); const color = getSourceColor(mod.source_type); return <Icon size={12} className={color} />; })()}
                        {t(`sources.${mod.source_type}`)}
                      </span>
                    </div>
                    <p className="text-text-secondary text-sm line-clamp-2 mb-3">
                      {mod.summary}
                    </p>
                    <span className="text-text-muted text-xs">
                      {timeAgo(mod.created_at)}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
