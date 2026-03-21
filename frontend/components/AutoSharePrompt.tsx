"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, X } from "lucide-react";
import { useLocale } from "@/lib/LocaleContext";

interface Props {
  show: boolean;
  onShare: () => void;
  onDismiss: () => void;
}

export default function AutoSharePrompt({ show, onShare, onDismiss }: Props) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [show, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25 }}
          className="fixed bottom-6 start-1/2 -translate-x-1/2 z-40 glass rounded-2xl p-4 flex items-center gap-4 shadow-xl max-w-md w-[calc(100%-3rem)]"
        >
          <div className="flex-1">
            <p className="text-text-primary text-sm font-bold">
              {t("share.greatScore")}
            </p>
            <p className="text-text-muted text-xs">
              {t("share.showOff")}
            </p>
          </div>
          <button
            onClick={() => {
              setVisible(false);
              onShare();
            }}
            className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-xl transition-colors flex items-center gap-1.5 shrink-0 text-sm"
          >
            <Share2 size={14} />
            {t("common.share")}
          </button>
          <button
            onClick={() => {
              setVisible(false);
              onDismiss();
            }}
            className="text-text-muted hover:text-text-primary transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
