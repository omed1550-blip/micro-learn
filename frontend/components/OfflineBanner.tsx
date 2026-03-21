"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi } from "lucide-react";
import { useOffline } from "@/lib/OfflineContext";
import { useLocale } from "@/lib/LocaleContext";

export default function OfflineBanner() {
  const { isOnline, pendingSync, lastSynced } = useOffline();
  const { t } = useLocale();
  const [wasOffline, setWasOffline] = useState(false);
  const [showSynced, setShowSynced] = useState(false);

  // Track transition from offline → online
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      // Just came back online
      setWasOffline(false);
    }
  }, [isOnline, wasOffline]);

  // Show "synced" banner briefly when lastSynced changes
  useEffect(() => {
    if (lastSynced) {
      setShowSynced(true);
      const timer = setTimeout(() => setShowSynced(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSynced]);

  const showOffline = !isOnline;
  const showSyncedBanner = isOnline && showSynced;

  return (
    <AnimatePresence>
      {showOffline && (
        <motion.div
          key="offline"
          initial={{ y: -60 }}
          animate={{ y: 0 }}
          exit={{ y: -60 }}
          className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 py-2.5 px-4"
          style={{ background: "rgba(245, 158, 11, 0.15)", backdropFilter: "blur(8px)" }}
        >
          <WifiOff size={16} className="text-warning shrink-0" />
          <span className="text-text-secondary text-sm">
            {t("offline.offlineBanner")}
            {pendingSync > 0 && (
              <span className="text-text-muted ms-2">
                ({t("offline.pendingSync", { count: pendingSync })})
              </span>
            )}
          </span>
        </motion.div>
      )}
      {showSyncedBanner && (
        <motion.div
          key="synced"
          initial={{ y: -60 }}
          animate={{ y: 0 }}
          exit={{ y: -60 }}
          className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 py-2.5 px-4"
          style={{ background: "rgba(34, 197, 94, 0.15)", backdropFilter: "blur(8px)" }}
        >
          <Wifi size={16} className="text-success shrink-0" />
          <span className="text-text-secondary text-sm">
            {t("offline.backOnline")}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
