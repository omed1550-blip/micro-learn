"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Download, Youtube, FileText, Loader2 } from "lucide-react";
// html2canvas is imported dynamically in handleDownload to avoid SSR issues
import { useLocale } from "@/lib/LocaleContext";
import { successBuzz } from "@/lib/haptics";

interface Props {
  moduleTitle: string;
  sourceType: "youtube" | "article";
  totalCards: number;
  masteredCards: number;
  quizScore: number;
  onClose: () => void;
}

export default function ShareableSnapshot({
  moduleTitle,
  sourceType,
  totalCards,
  masteredCards,
  quizScore,
  onClose,
}: Props) {
  const { t } = useLocale();
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const masteryPct =
    totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;
  const circumference = 2 * Math.PI * 26;
  const offset = circumference - (masteryPct / 100) * circumference;

  const handleShare = async () => {
    const text = t("share.shareText", {
      title: moduleTitle,
      mastered: masteredCards,
      score: quizScore,
    });

    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current || downloading) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 1080 / cardRef.current.offsetWidth,
        backgroundColor: null,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `micro-learn-${moduleTitle.slice(0, 30).replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      successBuzz();
    } catch {
      // Silently fail
    } finally {
      setDownloading(false);
    }
  };

  const gridOpacities = [
    0.6, 0.2, 0.8, 0.3,
    0.3, 0.7, 0.2, 0.5,
    0.8, 0.3, 0.6, 0.2,
    0.2, 0.5, 0.3, 0.7,
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background: "rgba(0,0,0,0.8)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 flex flex-col items-center justify-center p-4 sm:relative sm:inset-auto sm:p-0"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:relative sm:top-auto sm:right-auto sm:self-end sm:mb-2 text-text-secondary hover:text-text-primary transition-colors z-10"
          >
            <X size={24} />
          </button>

          <div
            ref={cardRef}
            className="w-[270px] rounded-3xl overflow-hidden p-5 flex flex-col"
            style={{
              aspectRatio: "9 / 16",
              background: "linear-gradient(180deg, #252523 0%, #1a1a18 100%)",
            }}
          >
            <div className="mb-3">
              <p className="text-primary text-xs font-[800] tracking-widest uppercase">
                {t("common.appName")}
              </p>
              <div className="h-px bg-border mt-2" />
            </div>

            <div className="flex-1 flex flex-col justify-center">
              <p className="text-text-secondary text-xs font-semibold mb-1">
                {t("share.iJustLearned")}
              </p>
              <h2 className="text-text-primary text-lg font-[800] leading-tight line-clamp-3 mb-2">
                {moduleTitle}
              </h2>
              <span className="glass rounded-full px-2 py-0.5 text-[10px] text-text-secondary inline-flex items-center gap-1 self-start">
                {sourceType === "youtube" ? (
                  <Youtube size={8} />
                ) : (
                  <FileText size={8} />
                )}
                {sourceType === "youtube" ? t("modules.youtube") : t("modules.article")}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <p className="text-success text-2xl font-[800]">
                  {masteredCards}
                </p>
                <p className="text-text-secondary text-[9px]">{t("share.cardsMastered")}</p>
              </div>
              <div className="text-center">
                <p className="text-primary text-2xl font-[800]">{quizScore}%</p>
                <p className="text-text-secondary text-[9px]">{t("share.quizScore")}</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="relative w-12 h-12">
                  <svg
                    className="w-full h-full -rotate-90"
                    viewBox="0 0 60 60"
                  >
                    <circle
                      cx="30"
                      cy="30"
                      r="26"
                      fill="none"
                      stroke="#3a3a37"
                      strokeWidth="4"
                    />
                    <circle
                      cx="30"
                      cy="30"
                      r="26"
                      fill="none"
                      stroke="#6366F1"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-[800] text-text-primary">
                    {masteryPct}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-end justify-between">
              <p className="text-text-muted text-[9px]">
                {t("share.poweredBy")}
              </p>
              <div className="grid grid-cols-4 gap-0.5">
                {gridOpacities.map((op, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-sm"
                    style={{ background: `rgba(99,102,241,${op})` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full sm:w-auto">
            <button
              onClick={handleShare}
              className="bg-primary hover:bg-primary-hover text-white font-bold py-2.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-95 transition-transform duration-100"
            >
              <Share2 size={16} />
              {copied ? t("common.copied") : t("common.share")}
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="border border-primary text-primary hover:bg-primary hover:text-white disabled:opacity-50 font-bold py-2.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-95 transition-transform duration-100"
            >
              {downloading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {t("common.download")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
