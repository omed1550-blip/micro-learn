"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Layers,
  Trophy,
  TrendingUp,
  Clock,
  Coffee,
  Sparkles,
  Share2,
  Star,
  HelpCircle,
  Lightbulb,
} from "lucide-react";
import { getProgress, getDueCards, getRecommendation, Progress, Flashcard, Recommendation } from "@/lib/api";
import { useLocale } from "@/lib/LocaleContext";

interface Props {
  moduleId: string;
  moduleTitle: string;
  sourceType: string;
  totalFlashcards: number;
  totalQuizQuestions: number;
  refreshKey?: number;
  onStartReview?: () => void;
  onTakeQuiz?: () => void;
  onShare?: () => void;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  pulse,
  subtext,
  bar,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  pulse?: boolean;
  subtext?: string;
  bar?: { value: number; max: number; color: string };
}) {
  return (
    <div
      className={`bg-surface rounded-2xl p-4 sm:p-6 ${
        pulse ? "animate-pulse" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-secondary text-xs sm:text-sm font-semibold">
          {label}
        </span>
        <Icon size={18} className={`${color} sm:w-5 sm:h-5`} />
      </div>
      <p className={`text-3xl sm:text-4xl font-[800] ${color}`}>{value}</p>
      {bar && bar.max > 0 && (
        <div className="mt-3 w-full h-2 bg-surface-hover rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${bar.color}`}
            initial={{ width: "0%" }}
            animate={{
              width: `${Math.round((bar.value / bar.max) * 100)}%`,
            }}
            transition={{ duration: 0.8 }}
          />
        </div>
      )}
      {subtext && (
        <p className="text-text-muted text-xs mt-2">{subtext}</p>
      )}
    </div>
  );
}

export default function ProgressDashboard({
  moduleId,
  totalFlashcards,
  totalQuizQuestions,
  refreshKey = 0,
  onStartReview,
  onTakeQuiz,
  onShare,
}: Props) {
  const { t } = useLocale();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const hasFetchedRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const [prog, due] = await Promise.all([
        getProgress(moduleId),
        getDueCards(moduleId),
      ]);
      setProgress(prog);
      setDueCards(due);
      setFetchError(false);

      // Fetch recommendation (non-blocking)
      getRecommendation(moduleId)
        .then(setRecommendation)
        .catch(() => {});
    } catch {
      if (!hasFetchedRef.current) setFetchError(true);
    } finally {
      hasFetchedRef.current = true;
      setLoading(false);
    }
  }, [moduleId]);

  // Fetch on mount and when refreshKey changes
  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Periodic refresh
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-surface rounded-2xl p-6 h-28 animate-pulse"
            />
          ))}
        </div>
        <div className="flex justify-center">
          <div className="w-48 h-48 bg-surface rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (fetchError && !progress) {
    return (
      <div className="bg-surface rounded-xl p-6 text-center">
        <p className="text-text-secondary text-sm">{t("common.error")}</p>
      </div>
    );
  }

  const prog = progress!;
  const hasFlashcards = totalFlashcards > 0;
  const hasQuiz = totalQuizQuestions > 0;

  // No content at all
  if (!hasFlashcards && !hasQuiz) {
    return (
      <div className="bg-surface rounded-xl p-6 text-center">
        <Coffee size={32} className="text-text-muted mx-auto mb-2" />
        <p className="text-text-secondary text-sm">{t("progressDashboard.noContent")}</p>
      </div>
    );
  }

  // Overall mastery ring value
  const masteryPct = Math.round(prog.overall_mastery);
  const circumference = 2 * Math.PI * 88;
  const offset = circumference - (masteryPct / 100) * circumference;

  // Recommendation action handler
  const handleRecAction = () => {
    if (!recommendation) return;
    if (recommendation.action === "review_flashcards" && onStartReview) onStartReview();
    else if (recommendation.action === "take_quiz" && onTakeQuiz) onTakeQuiz();
  };

  // Quiz-only module
  if (!hasFlashcards && hasQuiz) {
    const bestPct = Math.round(prog.best_quiz_score);
    const hasAttempts = prog.quiz_attempts > 0;

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label={t("progressDashboard.quizQuestions")}
            value={totalQuizQuestions}
            icon={HelpCircle}
            color="text-primary"
          />
          <StatCard
            label={t("progressDashboard.bestScore")}
            value={hasAttempts ? `${bestPct}%` : "—"}
            icon={Star}
            color={hasAttempts ? "text-success" : "text-text-muted"}
            subtext={hasAttempts
              ? `${prog.quiz_attempts} ${t("progressDashboard.attempts")}`
              : t("progressDashboard.notAttempted")
            }
          />
        </div>

        {/* Mastery ring */}
        <div className="flex justify-center">
          <div className="relative w-36 h-36 sm:w-48 sm:h-48">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 192 192">
              <circle cx="96" cy="96" r="88" fill="none" stroke="#3a3a37" strokeWidth="8" />
              <motion.circle
                cx="96" cy="96" r="88" fill="none" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={masteryPct >= 80 ? "text-success" : masteryPct >= 50 ? "text-warning" : "text-primary"}
                stroke="currentColor"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl sm:text-4xl font-[800] text-text-primary">
                {hasAttempts ? `${masteryPct}%` : "—"}
              </span>
              <span className="text-text-secondary text-xs sm:text-sm">{t("progressDashboard.mastery")}</span>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        {recommendation && recommendation.action !== "all_mastered" && (
          <button
            onClick={handleRecAction}
            className="w-full bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl p-4 flex items-center gap-3 transition-colors text-start"
          >
            <Lightbulb size={20} className="text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-text-primary text-sm font-semibold">{recommendation.reason}</p>
              {recommendation.estimated_minutes > 0 && (
                <p className="text-text-muted text-xs mt-0.5">~{recommendation.estimated_minutes} min</p>
              )}
            </div>
          </button>
        )}

        {!hasAttempts && !recommendation && (
          <div className="bg-surface rounded-xl p-6 text-center">
            <HelpCircle size={32} className="text-text-muted mx-auto mb-2" />
            <p className="text-text-secondary text-sm">
              {t("progressDashboard.takeQuizToTrack")}
            </p>
          </div>
        )}

        {onShare && (
          <button
            onClick={onShare}
            className="w-full max-w-md mx-auto bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Share2 size={18} />
            {t("progressDashboard.shareProgress")}
          </button>
        )}
      </div>
    );
  }

  // Flashcard-based progress (with optional quiz stats)
  const newCards = prog.new_cards ?? Math.max(0, prog.total_cards - prog.mastered - prog.learning);

  const barSegments = [
    { label: t("progressDashboard.mastered"), value: prog.mastered, color: "bg-success", dotColor: "bg-success" },
    { label: t("progressDashboard.learning"), value: prog.learning, color: "bg-warning", dotColor: "bg-warning" },
    { label: t("progressDashboard.new"), value: newCards, color: "bg-surface-hover", dotColor: "bg-text-muted" },
  ];

  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;

  return (
    <div className="space-y-8">
      {/* Recommendation card */}
      {recommendation && recommendation.action !== "all_mastered" && (
        <button
          onClick={handleRecAction}
          className="w-full bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl p-4 flex items-center gap-3 transition-colors text-start"
        >
          <Lightbulb size={20} className="text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-text-primary text-sm font-semibold">{recommendation.reason}</p>
            {recommendation.estimated_minutes > 0 && (
              <p className="text-text-muted text-xs mt-0.5">~{recommendation.estimated_minutes} min</p>
            )}
          </div>
        </button>
      )}

      {recommendation && recommendation.action === "all_mastered" && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-center gap-3">
          <Trophy size={20} className="text-success shrink-0" />
          <p className="text-text-primary text-sm font-semibold">{recommendation.reason}</p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label={t("progressDashboard.totalCards")}
          value={prog.total_cards}
          icon={Layers}
          color="text-primary"
        />
        <StatCard
          label={t("progressDashboard.mastered")}
          value={prog.mastered}
          icon={Trophy}
          color="text-success"
          bar={{
            value: prog.mastered,
            max: prog.total_cards,
            color: "bg-success",
          }}
        />
        <StatCard
          label={t("progressDashboard.learning")}
          value={prog.learning}
          icon={TrendingUp}
          color="text-warning"
        />
        <StatCard
          label={t("progressDashboard.dueNow")}
          value={prog.due_now}
          icon={Clock}
          color={prog.due_now > 0 ? "text-error" : "text-text-muted"}
          pulse={prog.due_now > 0}
          subtext={prog.due_now === 0 ? t("progressDashboard.allCaughtUp") : undefined}
        />
      </div>

      {/* Quiz stats (if quiz exists) */}
      {hasQuiz && (
        <div className="bg-surface rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-secondary text-xs sm:text-sm font-semibold">
              {t("progressDashboard.quizScore")}
            </span>
            <Star size={18} className="text-success sm:w-5 sm:h-5" />
          </div>
          {prog.quiz_attempts > 0 ? (
            <>
              <p className="text-3xl sm:text-4xl font-[800] text-success">
                {Math.round(prog.best_quiz_score)}%
              </p>
              <p className="text-text-muted text-xs mt-2">
                {t("progressDashboard.bestScore")} · {prog.quiz_attempts} {t("progressDashboard.attempts")}
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl sm:text-4xl font-[800] text-text-muted">—</p>
              <p className="text-text-muted text-xs mt-2">{t("progressDashboard.notAttempted")}</p>
            </>
          )}
        </div>
      )}

      {/* Overall mastery ring */}
      <div className="flex justify-center">
        <div className="relative w-36 h-36 sm:w-48 sm:h-48">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 192 192">
            <circle cx="96" cy="96" r="88" fill="none" stroke="#3a3a37" strokeWidth="8" />
            <motion.circle
              cx="96" cy="96" r="88" fill="none" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={
                masteryPct >= 80 ? "text-success" : masteryPct >= 50 ? "text-warning" : "text-primary"
              }
              stroke="currentColor"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl sm:text-4xl font-[800] text-text-primary">
              {masteryPct}%
            </span>
            <span className="text-text-secondary text-xs sm:text-sm">{t("progressDashboard.mastery")}</span>
          </div>
        </div>
      </div>

      {/* Stacked bar chart */}
      {prog.total_cards > 0 && (
        <div>
          <h3 className="text-lg mb-3">{t("progressDashboard.cardDistribution")}</h3>
          <div className="w-full h-4 rounded-full overflow-hidden flex">
            {barSegments.map(
              (seg) =>
                seg.value > 0 && (
                  <motion.div
                    key={seg.label}
                    className={`h-full ${seg.color}`}
                    initial={{ width: "0%" }}
                    animate={{
                      width: `${(seg.value / prog.total_cards) * 100}%`,
                    }}
                    transition={{ duration: 0.8 }}
                  />
                )
            )}
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            {barSegments.map((seg) => (
              <div key={seg.label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${seg.dotColor}`} />
                <span className="text-text-secondary text-xs">
                  {seg.label} ({seg.value})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Due cards section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg">{t("progressDashboard.cardsDueForReview")}</h3>
          {dueCards.length > 0 && (
            <span className="bg-error text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {dueCards.length}
            </span>
          )}
        </div>
        {dueCards.length === 0 ? (
          <div className="bg-surface rounded-xl p-6 text-center">
            <Coffee size={32} className="text-text-muted mx-auto mb-2" />
            <p className="text-text-secondary text-sm">
              {t("progressDashboard.nothingDue")}
            </p>
          </div>
        ) : (
          <button
            onClick={onStartReview}
            className="w-full max-w-md mx-auto bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            {t("progressDashboard.startReview")}
          </button>
        )}
      </div>

      {/* Study streak */}
      <div>
        <h3 className="text-lg mb-4">{t("progressDashboard.studyActivity")}</h3>
        <div className="flex justify-center gap-2">
          {days.map((day, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-md ${
                  i === todayIdx ? "bg-primary" : "bg-surface-hover"
                }`}
              />
              <span className="text-text-muted text-xs">{day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Share Progress button */}
      {onShare && (
        <button
          onClick={onShare}
          className="w-full max-w-md mx-auto bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Share2 size={18} />
          {t("progressDashboard.shareProgress")}
        </button>
      )}
    </div>
  );
}
