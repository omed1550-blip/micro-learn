"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";
import { useXP } from "@/lib/XPContext";
import { useLocale } from "@/lib/LocaleContext";

export default function LevelUpModal() {
  const { levelUpEvent, dismissLevelUp } = useXP();
  const { t } = useLocale();
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);

  useEffect(() => {
    if (levelUpEvent) {
      const colors = ["#6366F1", "#F59E0B", "#10B981", "#EC4899", "#06B6D4", "#EF4444"];
      const newParticles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
      setParticles(newParticles);
    }
  }, [levelUpEvent]);

  return (
    <AnimatePresence>
      {levelUpEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          onClick={dismissLevelUp}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Confetti */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: "50vw", y: "50vh", scale: 0 }}
              animate={{
                x: `${p.x}vw`,
                y: `${p.y}vh`,
                scale: [0, 1.5, 0],
                rotate: [0, 360, 720],
              }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="absolute w-3 h-3 rounded-sm"
              style={{ backgroundColor: p.color }}
            />
          ))}

          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", damping: 15, stiffness: 200 }}
            className="relative bg-surface rounded-2xl border border-border shadow-2xl p-8 text-center max-w-sm"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <Star size={40} className="text-primary fill-primary" />
            </motion.div>
            <h2 className="text-2xl font-[800] text-text-primary mb-2">
              {t("activity.levelUp")}
            </h2>
            <p className="text-4xl font-[900] text-primary mb-4">
              {t("activity.level").replace("{level}", String(levelUpEvent.newLevel))}
            </p>
            <button
              onClick={dismissLevelUp}
              className="bg-primary hover:bg-primary-hover text-white font-[700] py-2.5 px-6 rounded-xl transition-colors"
            >
              {t("activity.keepLearning").split(" ")[0]}!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
