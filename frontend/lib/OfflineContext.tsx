"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { offlineStorage } from "./offlineStorage";
import { syncService } from "./syncService";

interface OfflineContextValue {
  isOnline: boolean;
  pendingSync: number;
  lastSynced: Date | null;
  syncNow: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  pendingSync: 0,
  lastSynced: null,
  syncNow: async () => {},
});

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Initialize storage and sync service
    offlineStorage.init().then(() => {
      syncService.init();
      setReady(true);
      setIsOnline(syncService.isOnline);
      offlineStorage.getPendingCount().then(setPendingSync);
    }).catch(() => {
      setReady(true); // continue without offline support
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsub = syncService.onSync(() => {
      setLastSynced(new Date());
      offlineStorage.getPendingCount().then(setPendingSync);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsub();
    };
  }, []);

  // Refresh pending count periodically when offline
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      offlineStorage.getPendingCount().then(setPendingSync);
    }, 5000);
    return () => clearInterval(id);
  }, [ready]);

  const syncNow = useCallback(async () => {
    await syncService.syncAll();
    const count = await offlineStorage.getPendingCount();
    setPendingSync(count);
  }, []);

  return (
    <OfflineContext.Provider value={{ isOnline, pendingSync, lastSynced, syncNow }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  return useContext(OfflineContext);
}
