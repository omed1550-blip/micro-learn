"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useXP } from "@/lib/XPContext";
import { useLocale } from "@/lib/LocaleContext";

export default function XPPopup() {
  const { xpEvents } = useXP();
  const { t } = useLocale();

  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {xpEvents.map((event) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            className="bg-primary text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 pointer-events-auto"
          >
            <span className="text-lg font-[800]">
              {t("activity.xpEarned").replace("{xp}", String(event.xp))}
            </span>
            {event.multiplier > 1 && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {event.multiplier.toFixed(1)}x
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
