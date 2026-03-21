"use client";

import { motion } from "framer-motion";
import { PlayCircle, RotateCcw } from "lucide-react";
import { useLocale } from "@/lib/LocaleContext";

interface Props {
  sessionType: "flashcards" | "quiz";
  current: number;
  total: number;
  onResume: () => void;
  onStartOver: () => void;
}

export default function ResumePrompt({ sessionType, current, total, onResume, onStartOver }: Props) {
  const { t } = useLocale();
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  const progressText = sessionType === "flashcards"
    ? t("session.flashcardProgress", { reviewed: current, total })
    : t("session.quizProgress", { answered: current, total });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center py-8 sm:py-12"
    >
      <div className="glass rounded-2xl p-6 sm:p-8 w-full max-w-md text-center">
        <div className="rounded-full bg-primary/20 p-4 mx-auto w-fit mb-4">
          <PlayCircle size={36} className="text-primary" />
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-text-primary mb-2">
          {t("session.resumeTitle")}
        </h3>

        <p className="text-text-secondary text-sm mb-4">{progressText}</p>

        {/* Progress bar */}
        <div className="w-full bg-surface-hover rounded-full h-2.5 mb-6">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="bg-primary h-2.5 rounded-full"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onStartOver}
            className="flex-1 border border-border text-text-secondary hover:text-text-primary hover:border-primary font-bold py-3 px-4 rounded-xl transition-colors active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-2 text-sm"
          >
            <RotateCcw size={16} />
            {t("session.startOver")}
          </button>
          <button
            onClick={onResume}
            className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-3 px-4 rounded-xl transition-colors active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-2 text-sm"
          >
            <PlayCircle size={16} />
            {t("session.resume")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
