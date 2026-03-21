"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Flame, Trophy, Star, Zap, Target, Clock,
  BookOpen, Brain, Award, ChevronLeft, ChevronRight,
} from "lucide-react";
import { getDashboard, getActivityCalendar, updateDailyGoal, DashboardData, CalendarDay } from "@/lib/api";
import { useLocale } from "@/lib/LocaleContext";

const ICON_MAP: Record<string, typeof Star> = {
  star: Star, zap: Zap, flame: Flame, rocket: Zap,
  crown: Trophy, clipboard: BookOpen, award: Award,
  target: Target, diamond: Star, "plus-circle": Star,
  layers: BookOpen, building: Brain, calendar: Clock,
  shield: Award, trophy: Trophy, "graduation-cap": Brain,
};

function formatTime(seconds: number): string {
  if (seconds < 60) return "<1m";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function Heatmap({ calendar, t }: { calendar: CalendarDay[]; t: (k: string) => string }) {
  const weeks = 52;
  const days = weeks * 7;

  const dataMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of calendar) m[d.date] = d.xp;
    return m;
  }, [calendar]);

  const cells = useMemo(() => {
    const today = new Date();
    const result: { date: string; xp: number; col: number; row: number }[] = [];
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days + 1);
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    for (let col = 0; col < weeks + 1; col++) {
      for (let row = 0; row < 7; row++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + col * 7 + row);
        if (d > today) continue;
        const dateStr = d.toISOString().split("T")[0];
        result.push({ date: dateStr, xp: dataMap[dateStr] || 0, col, row });
      }
    }
    return result;
  }, [dataMap, days, weeks]);

  const maxXP = Math.max(1, ...cells.map((c) => c.xp));
  const activeDays = cells.filter((c) => c.xp > 0).length;

  const getColor = (xp: number) => {
    if (xp === 0) return "bg-surface-hover";
    const ratio = xp / maxXP;
    if (ratio < 0.25) return "bg-primary/25";
    if (ratio < 0.5) return "bg-primary/50";
    if (ratio < 0.75) return "bg-primary/75";
    return "bg-primary";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-[700] text-text-primary">{t("activity.activityThisYear")}</p>
        <p className="text-xs text-text-muted">{t("activity.activeDays").replace("{count}", String(activeDays))}</p>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks + 1}, 12px)`, gridTemplateRows: "repeat(7, 12px)" }}>
          {cells.map((cell) => (
            <div
              key={cell.date}
              className={`w-3 h-3 rounded-[3px] ${getColor(cell.xp)} transition-colors`}
              style={{ gridColumn: cell.col + 1, gridRow: cell.row + 1 }}
              title={`${cell.date}: ${cell.xp} XP`}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2 justify-end">
        <span className="text-[10px] text-text-muted mr-1">{t("activity.noActivity")}</span>
        <div className="w-3 h-3 rounded-[3px] bg-surface-hover" />
        <div className="w-3 h-3 rounded-[3px] bg-primary/25" />
        <div className="w-3 h-3 rounded-[3px] bg-primary/50" />
        <div className="w-3 h-3 rounded-[3px] bg-primary/75" />
        <div className="w-3 h-3 rounded-[3px] bg-primary" />
        <span className="text-[10px] text-text-muted ml-1">{t("activity.high")}</span>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const { t } = useLocale();
  const [data, setData] = useState<DashboardData | null>(null);
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalInput, setGoalInput] = useState<number | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);

  useEffect(() => {
    Promise.all([getDashboard(), getActivityCalendar()])
      .then(([d, c]) => {
        setData(d);
        setCalendar(c);
        setGoalInput(d.daily_goal);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleGoalSave = async () => {
    if (!goalInput || goalInput < 10) return;
    await updateDailyGoal(goalInput);
    setData((prev) => prev ? { ...prev, daily_goal: goalInput } : prev);
    setEditingGoal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const goalPercent = Math.min(100, Math.round((data.daily_xp / data.daily_goal) * 100));
  const levelPercent = data.xp_needed > 0 ? Math.min(100, Math.round((data.xp_in_level / data.xp_needed) * 100)) : 100;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      {/* Streak Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary/20 via-surface to-surface rounded-2xl border border-border p-6 text-center"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 rounded-full mb-3">
          <Flame size={40} className={data.streak > 0 ? "text-orange-400" : "text-text-muted"} />
        </div>
        {data.streak > 0 ? (
          <>
            <p className="text-5xl font-[900] text-text-primary">{data.streak}</p>
            <p className="text-sm text-text-secondary mt-1">
              {t("activity.daysStreak").replace("{count}", String(data.streak))}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {t("activity.longestStreak").replace("{count}", String(data.longest_streak))}
            </p>
            {data.streak_at_risk && (
              <div className="mt-3 bg-warning/10 border border-warning/20 text-warning text-xs rounded-xl px-4 py-2 inline-block">
                {t("activity.streakAtRisk")}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-lg font-[700] text-text-primary">{t("activity.startStreak")}</p>
            <p className="text-sm text-text-muted mt-1">{t("activity.studyToStart")}</p>
          </>
        )}
        {data.multiplier > 1 && (
          <p className="text-xs text-primary mt-2 font-bold">
            {t("activity.streakBonus")} {data.multiplier.toFixed(1)}x XP
          </p>
        )}
      </motion.div>

      {/* Level & XP + Daily Goal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Level */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface rounded-2xl border border-border p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
              <Star size={24} className="text-primary" />
            </div>
            <div>
              <p className="text-2xl font-[800] text-text-primary">
                {t("activity.level").replace("{level}", String(data.level))}
              </p>
              <p className="text-xs text-text-muted">
                {t("activity.totalXP").replace("{xp}", data.total_xp.toLocaleString())}
              </p>
            </div>
          </div>
          <div className="w-full h-3 bg-background rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${levelPercent}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-primary rounded-full"
            />
          </div>
          <p className="text-[10px] text-text-muted mt-1 text-right">
            {t("activity.xpProgress")
              .replace("{current}", data.xp_in_level.toLocaleString())
              .replace("{next}", data.xp_needed.toLocaleString())}
          </p>
        </motion.div>

        {/* Daily Goal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-surface rounded-2xl border border-border p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target size={20} className={data.daily_goal_met ? "text-success" : "text-text-muted"} />
              <p className="text-sm font-[700] text-text-primary">{t("activity.dailyGoal")}</p>
            </div>
            {!editingGoal ? (
              <button onClick={() => setEditingGoal(true)} className="text-xs text-primary hover:underline">
                {t("activity.setGoal")}
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button onClick={() => setGoalInput((g) => Math.max(10, (g || 50) - 10))} className="text-text-muted hover:text-text-primary p-0.5">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-bold text-text-primary w-8 text-center">{goalInput}</span>
                <button onClick={() => setGoalInput((g) => Math.min(500, (g || 50) + 10))} className="text-text-muted hover:text-text-primary p-0.5">
                  <ChevronRight size={14} />
                </button>
                <button onClick={handleGoalSave} className="text-xs text-primary font-bold ml-1">OK</button>
              </div>
            )}
          </div>
          <div className="w-full h-3 bg-background rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${goalPercent}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full rounded-full ${data.daily_goal_met ? "bg-success" : "bg-primary"}`}
            />
          </div>
          <p className="text-xs text-text-muted mt-2">
            {t("activity.xpToday")
              .replace("{earned}", String(data.daily_xp))
              .replace("{goal}", String(data.daily_goal))}
          </p>
          {data.daily_goal_met && (
            <p className="text-xs text-success font-bold mt-1">{t("activity.goalMet")}</p>
          )}
        </motion.div>
      </div>

      {/* Today's Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-3 gap-3"
      >
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <BookOpen size={18} className="text-primary mx-auto mb-1" />
          <p className="text-lg font-[800] text-text-primary">{data.today_cards_reviewed}</p>
          <p className="text-[10px] text-text-muted">{t("activity.cardsToday").replace("{count}", "").trim()}</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <Brain size={18} className="text-primary mx-auto mb-1" />
          <p className="text-lg font-[800] text-text-primary">{data.today_quizzes}</p>
          <p className="text-[10px] text-text-muted">{t("activity.totalQuizzes")}</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 text-center">
          <Clock size={18} className="text-primary mx-auto mb-1" />
          <p className="text-lg font-[800] text-text-primary">{formatTime(data.today_study_seconds)}</p>
          <p className="text-[10px] text-text-muted">{t("activity.timeToday").replace("{minutes}", "").trim()}</p>
        </div>
      </motion.div>

      {/* Heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-surface rounded-2xl border border-border p-5"
      >
        <Heatmap calendar={calendar} t={t} />
      </motion.div>

      {/* Achievements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-surface rounded-2xl border border-border p-5"
      >
        <p className="text-sm font-[700] text-text-primary mb-4">{t("activity.achievements")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.achievements.map((ach) => {
            const IconComp = ICON_MAP[ach.icon] || Award;
            return (
              <div
                key={ach.id}
                className={`rounded-xl p-3 text-center transition-colors ${
                  ach.unlocked
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-background border border-border opacity-50"
                }`}
              >
                <IconComp
                  size={24}
                  className={`mx-auto mb-1 ${ach.unlocked ? "text-primary" : "text-text-muted"}`}
                />
                <p className="text-xs font-[700] text-text-primary truncate">{ach.name}</p>
                <p className="text-[10px] text-text-muted mt-0.5 line-clamp-2">{ach.description}</p>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Lifetime Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-surface rounded-2xl border border-border p-5"
      >
        <p className="text-sm font-[700] text-text-primary mb-4">{t("activity.lifetimeStats")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-[800] text-text-primary">{data.lifetime.total_cards_reviewed}</p>
            <p className="text-xs text-text-muted">{t("activity.totalCardsReviewed")}</p>
          </div>
          <div>
            <p className="text-2xl font-[800] text-text-primary">{data.lifetime.total_quizzes_completed}</p>
            <p className="text-xs text-text-muted">{t("activity.totalQuizzes")}</p>
          </div>
          <div>
            <p className="text-2xl font-[800] text-text-primary">{data.lifetime.total_modules_created}</p>
            <p className="text-xs text-text-muted">{t("activity.totalModules")}</p>
          </div>
          <div>
            <p className="text-2xl font-[800] text-text-primary">{formatTime(data.lifetime.total_study_seconds)}</p>
            <p className="text-xs text-text-muted">{t("activity.totalStudyTime")}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
