"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Award } from "lucide-react";
import { useXP } from "@/lib/XPContext";
import { useLocale } from "@/lib/LocaleContext";

export default function AchievementUnlock() {
  const { achievementEvents, dismissAchievement } = useXP();
  const { t } = useLocale();

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {achievementEvents.map((ach) => (
          <motion.div
            key={ach.id}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            onClick={() => dismissAchievement(ach.id)}
            className="bg-surface border border-border rounded-xl shadow-2xl p-4 flex items-center gap-3 max-w-xs pointer-events-auto cursor-pointer"
          >
            <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center shrink-0">
              <Award size={20} className="text-yellow-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">
                {t("activity.achievementUnlocked")}
              </p>
              <p className="text-sm font-[700] text-text-primary">{ach.name}</p>
              <p className="text-xs text-text-muted">{ach.description}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
