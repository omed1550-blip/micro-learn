"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ActivityResult } from "@/lib/api";

interface XPEvent {
  id: string;
  xp: number;
  multiplier: number;
  streak: number;
}

interface LevelUpEvent {
  newLevel: number;
}

interface AchievementEvent {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface XPContextType {
  xpEvents: XPEvent[];
  levelUpEvent: LevelUpEvent | null;
  achievementEvents: AchievementEvent[];
  handleActivityResult: (result: ActivityResult) => void;
  dismissXP: (id: string) => void;
  dismissLevelUp: () => void;
  dismissAchievement: (id: string) => void;
}

const XPContext = createContext<XPContextType | null>(null);

export function useXP() {
  const ctx = useContext(XPContext);
  if (!ctx) throw new Error("useXP must be used within XPProvider");
  return ctx;
}

export function XPProvider({ children }: { children: ReactNode }) {
  const [xpEvents, setXpEvents] = useState<XPEvent[]>([]);
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);
  const [achievementEvents, setAchievementEvents] = useState<AchievementEvent[]>([]);

  const handleActivityResult = useCallback((result: ActivityResult) => {
    if (result.xp_earned > 0) {
      const id = `xp-${Date.now()}-${Math.random()}`;
      setXpEvents((prev) => [...prev, { id, xp: result.xp_earned, multiplier: result.multiplier, streak: result.streak }]);
      setTimeout(() => {
        setXpEvents((prev) => prev.filter((e) => e.id !== id));
      }, 3000);
    }

    if (result.level_up && result.new_level) {
      setLevelUpEvent({ newLevel: result.new_level });
    }

    if (result.new_achievements.length > 0) {
      setAchievementEvents((prev) => [...prev, ...result.new_achievements]);
      setTimeout(() => {
        setAchievementEvents((prev) => prev.slice(result.new_achievements.length));
      }, 5000);
    }
  }, []);

  const dismissXP = useCallback((id: string) => {
    setXpEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const dismissLevelUp = useCallback(() => {
    setLevelUpEvent(null);
  }, []);

  const dismissAchievement = useCallback((id: string) => {
    setAchievementEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return (
    <XPContext.Provider value={{ xpEvents, levelUpEvent, achievementEvents, handleActivityResult, dismissXP, dismissLevelUp, dismissAchievement }}>
      {children}
    </XPContext.Provider>
  );
}
