"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Layers,
  HelpCircle,
  BarChart3,
  Check,
  Frown,
  Meh,
  Smile,
  RotateCcw,
  AlertCircle,
  Share2,
  Minimize2,
  Lightbulb,
  Globe as GlobeIcon,
  Loader2,
  X,
} from "lucide-react";
import {
  getModule,
  reviewCard,
  submitQuiz,
  getStudyQueue,
  explainAgain,
  startSession,
  updateSession,
  completeSession,
  getActiveSession,
  LearningModule,
  Flashcard,
  StudySession,
  SourceType,
} from "@/lib/api";
import { getSourceIcon, getSourceColor } from "@/lib/sourceIcons";
import ProgressDashboard from "@/components/ProgressDashboard";
import ShareableSnapshot from "@/components/ShareableSnapshot";
import AutoSharePrompt from "@/components/AutoSharePrompt";
import LanguagePicker from "@/components/LanguagePicker";
import PageTransition from "@/components/PageTransition";
import Skeleton from "@/components/Skeleton";
import ResumePrompt from "@/components/ResumePrompt";
import { useLocale } from "@/lib/LocaleContext";
import { useOffline } from "@/lib/OfflineContext";
import { offlineStorage } from "@/lib/offlineStorage";
import { calculateNextReview } from "@/lib/sm2";
import { lightTap, successBuzz, errorBuzz, celebrationBuzz } from "@/lib/haptics";

type Tab = "summary" | "flashcards" | "quiz" | "progress";

export default function LearnPage({
  params,
}: {
  params: { moduleId: string };
}) {
  const { moduleId } = params;
  const { t, direction } = useLocale();
  const isRTL = direction === "rtl";
  const [mod, setMod] = useState<LearningModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("summary");

  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasFlippedOnce, setHasFlippedOnce] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [deckComplete, setDeckComplete] = useState(false);
  const [cardDirection, setCardDirection] = useState<"left" | "right" | "up" | null>(null);
  const [cardsReviewed, setCardsReviewed] = useState(0);
  const cardShownAtRef = useRef<number>(Date.now());

  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);

  const [studyCards, setStudyCards] = useState<Flashcard[] | null>(null);
  const [progressKey, setProgressKey] = useState(0);

  const [showSnapshot, setShowSnapshot] = useState(false);
  const [snapshotQuizScore, setSnapshotQuizScore] = useState(0);
  const [showAutoShare, setShowAutoShare] = useState(false);

  const [explainLoading, setExplainLoading] = useState(false);
  const [altExplanation, setAltExplanation] = useState<string | null>(null);

  // Session state
  const [flashcardSession, setFlashcardSession] = useState<StudySession | null>(null);
  const [quizSession, setQuizSession] = useState<StudySession | null>(null);
  const [showFlashcardResume, setShowFlashcardResume] = useState(false);
  const [showQuizResume, setShowQuizResume] = useState(false);
  const [pendingResumeSession, setPendingResumeSession] = useState<StudySession | null>(null);
  const [sessionChecked, setSessionChecked] = useState<{ flashcards: boolean; quiz: boolean }>({ flashcards: false, quiz: false });

  const { isOnline } = useOffline();

  useEffect(() => {
    getModule(moduleId)
      .then((m) => {
        setMod(m);
        // Cache for offline use (fire and forget)
        offlineStorage.saveModule(m).catch(() => {});
      })
      .catch(async (err) => {
        // Try offline fallback
        try {
          const cached = await offlineStorage.getModule(moduleId);
          if (cached) {
            setMod(cached);
            return;
          }
        } catch {}
        if (err instanceof Error && err.message === "Not found.") setError(t("learn.moduleNotFound"));
        else setError(err instanceof Error ? err.message : t("learn.failedToLoad"));
      })
      .finally(() => setLoading(false));
  }, [moduleId, t]);

  const handleFlip = () => {
    lightTap();
    setIsFlipped(!isFlipped);
    if (!isFlipped) {
      setShowRating(true);
      if (!hasFlippedOnce) setHasFlippedOnce(true);
    }
  };

  // Reset timer when a new card appears
  useEffect(() => {
    cardShownAtRef.current = Date.now();
  }, [cardIndex]);

  const handleRate = async (quality: number) => {
    if (!mod) return;
    const deck = studyCards || mod.flashcards;
    lightTap();
    const card = deck[cardIndex];
    const newReviewed = cardsReviewed + 1;
    setCardsReviewed(newReviewed);
    const timeSpent = (Date.now() - cardShownAtRef.current) / 1000;

    const dir = quality === 5 ? "right" : quality === 1 ? "left" : "up";
    setCardDirection(dir);

    if (isOnline) {
      try {
        await reviewCard(card.id, quality, timeSpent);
      } catch {}
    } else {
      // Save for offline sync and update card locally
      offlineStorage.savePendingReview({
        flashcard_id: card.id,
        quality,
        time_spent_seconds: timeSpent,
        reviewed_at: new Date().toISOString(),
      }).catch(() => {});
      // Apply SM-2+ locally for immediate feedback
      const updated = calculateNextReview(quality, card.repetitions, card.easiness_factor, card.interval_days);
      card.repetitions = updated.repetitions;
      card.easiness_factor = updated.easinessFactor;
      card.interval_days = updated.intervalDays;
    }

    // Save session progress (fire and forget)
    if (flashcardSession) {
      const newResults = [...(flashcardSession.card_results || []), { card_id: card.id, quality, flipped: true }];
      const nextIdx = cardIndex + 1;
      updateSession(moduleId, flashcardSession.id, {
        current_card_index: nextIdx,
        cards_reviewed: newReviewed,
        card_results: newResults,
      }).then((s) => setFlashcardSession(s)).catch(() => {});
    }

    setTimeout(() => {
      setCardDirection(null);
      setIsFlipped(false);
      setShowRating(false);
      if (cardIndex + 1 >= deck.length) {
        setDeckComplete(true);
        setProgressKey((k) => k + 1);
        celebrationBuzz();
        // Complete the session
        if (flashcardSession) {
          completeSession(moduleId, flashcardSession.id).then(() => setFlashcardSession(null)).catch(() => {});
        }
      } else {
        setCardIndex(cardIndex + 1);
      }
    }, 400);
  };

  const resetDeck = () => {
    setCardIndex(0);
    setIsFlipped(false);
    setShowRating(false);
    setDeckComplete(false);
    setCardsReviewed(0);
    setHasFlippedOnce(false);
    setStudyCards(null);
    // Complete old session if any, start fresh
    if (flashcardSession) {
      completeSession(moduleId, flashcardSession.id).catch(() => {});
      setFlashcardSession(null);
    }
    startSession(moduleId, "flashcards").then(setFlashcardSession).catch(() => {});
  };

  const startSmartReview = async () => {
    // Check for active flashcard session first
    if (!sessionChecked.flashcards) {
      try {
        const active = await getActiveSession(moduleId);
        if (active && active.session_type === "flashcards" && active.cards_reviewed > 0) {
          setPendingResumeSession(active);
          setShowFlashcardResume(true);
          setActiveTab("flashcards");
          setSessionChecked((s) => ({ ...s, flashcards: true }));
          return;
        }
      } catch {}
      setSessionChecked((s) => ({ ...s, flashcards: true }));
    }

    setCardIndex(0);
    setIsFlipped(false);
    setShowRating(false);
    setDeckComplete(false);
    setCardsReviewed(0);
    setHasFlippedOnce(false);
    setStudyCards(null);
    try {
      const queue = await getStudyQueue(moduleId);
      if (queue.length > 0) {
        setStudyCards(queue);
      }
    } catch {
      // Fall back to all flashcards
    }
    // Start a new session
    startSession(moduleId, "flashcards").then(setFlashcardSession).catch(() => {});
    setActiveTab("flashcards");
  };

  const handleQuizAnswer = (idx: number) => {
    if (selectedAnswer !== null || !mod) return;
    lightTap();
    setSelectedAnswer(idx);
    const q = mod.quiz_questions[quizIndex];
    const correct = idx === q.correct_answer;
    if (correct) {
      setQuizScore((s) => s + 1);
      successBuzz();
    } else {
      errorBuzz();
    }

    // Save quiz progress (fire and forget)
    if (quizSession) {
      const newAnswers = [...(quizSession.quiz_answers || []), {
        question_id: q.id,
        selected_answer: idx,
        is_correct: correct,
      }];
      updateSession(moduleId, quizSession.id, {
        current_question_index: quizIndex,
        questions_answered: quizIndex + 1,
        quiz_answers: newAnswers,
      }).then(setQuizSession).catch(() => {});
    }
  };

  const nextQuestion = () => {
    if (!mod) return;
    setSelectedAnswer(null);
    if (quizIndex + 1 >= mod.quiz_questions.length) {
      setQuizComplete(true);
      const finalScore = quizScore;
      const totalQ = mod.quiz_questions.length;
      const pct = Math.round((finalScore / totalQ) * 100);
      // Complete session (which creates QuizAttempt on backend)
      if (isOnline) {
        if (quizSession) {
          completeSession(moduleId, quizSession.id)
            .then(() => { setQuizSession(null); setProgressKey((k) => k + 1); })
            .catch(() => {});
        } else {
          submitQuiz(moduleId, finalScore, totalQ)
            .then(() => setProgressKey((k) => k + 1))
            .catch(() => {});
        }
      } else {
        // Save for offline sync
        offlineStorage.savePendingQuizSubmission({
          module_id: moduleId,
          score: finalScore,
          total: totalQ,
          completed_at: new Date().toISOString(),
        }).catch(() => {});
      }
      if (pct >= 80) celebrationBuzz();
      else successBuzz();
      if (pct >= 70) setShowAutoShare(true);
    } else {
      setQuizIndex(quizIndex + 1);
    }
  };

  const resetQuiz = () => {
    setQuizIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setQuizComplete(false);
    if (quizSession) {
      completeSession(moduleId, quizSession.id).catch(() => {});
      setQuizSession(null);
    }
    startSession(moduleId, "quiz").then(setQuizSession).catch(() => {});
  };

  const openShareFromDeck = () => {
    setSnapshotQuizScore(0);
    setShowSnapshot(true);
  };

  const openShareFromQuiz = () => {
    if (!mod) return;
    setSnapshotQuizScore(
      Math.round((quizScore / mod.quiz_questions.length) * 100)
    );
    setShowSnapshot(true);
  };

  const handleExplainAgain = async (mode: "simplify" | "analogy" | "real_world") => {
    setExplainLoading(true);
    setAltExplanation(null);
    try {
      const res = await explainAgain(moduleId, mode);
      setAltExplanation(res.explanation);
    } catch {
      setAltExplanation("Failed to generate explanation. Please try again.");
    } finally {
      setExplainLoading(false);
    }
  };

  // Resume flashcard session from where user left off
  const handleFlashcardResume = () => {
    if (!pendingResumeSession || !mod) return;
    const s = pendingResumeSession;
    setFlashcardSession(s);
    setCardIndex(s.current_card_index);
    setCardsReviewed(s.cards_reviewed);
    setShowFlashcardResume(false);
    setPendingResumeSession(null);
  };

  const handleFlashcardStartOver = () => {
    if (pendingResumeSession) {
      completeSession(moduleId, pendingResumeSession.id).catch(() => {});
    }
    setShowFlashcardResume(false);
    setPendingResumeSession(null);
    setCardIndex(0);
    setCardsReviewed(0);
    setIsFlipped(false);
    setShowRating(false);
    setHasFlippedOnce(false);
    startSession(moduleId, "flashcards").then(setFlashcardSession).catch(() => {});
  };

  // Resume quiz session
  const handleQuizResume = () => {
    if (!pendingResumeSession || !mod) return;
    const s = pendingResumeSession;
    setQuizSession(s);
    setQuizIndex(s.current_question_index + 1);
    // Recalculate score from saved answers
    const savedScore = (s.quiz_answers || []).filter((a) => (a as Record<string, unknown>).is_correct).length;
    setQuizScore(savedScore);
    setShowQuizResume(false);
    setPendingResumeSession(null);
  };

  const handleQuizStartOver = () => {
    if (pendingResumeSession) {
      completeSession(moduleId, pendingResumeSession.id).catch(() => {});
    }
    setShowQuizResume(false);
    setPendingResumeSession(null);
    setQuizIndex(0);
    setQuizScore(0);
    setSelectedAnswer(null);
    startSession(moduleId, "quiz").then(setQuizSession).catch(() => {});
  };

  // Check for active quiz session when switching to quiz tab
  const handleQuizTabStart = async () => {
    if (!sessionChecked.quiz) {
      try {
        const active = await getActiveSession(moduleId);
        if (active && active.session_type === "quiz" && active.questions_answered > 0) {
          setPendingResumeSession(active);
          setShowQuizResume(true);
          setSessionChecked((s) => ({ ...s, quiz: true }));
          return;
        }
      } catch {}
      setSessionChecked((s) => ({ ...s, quiz: true }));
    }
    // Start new quiz session if none active
    if (!quizSession) {
      startSession(moduleId, "quiz").then(setQuizSession).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen px-4 sm:px-6 py-6 sm:py-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton width="20px" height="20px" rounded />
          <Skeleton width="200px" height="24px" />
        </div>
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height="40px" className="flex-1" />
          ))}
        </div>
        <Skeleton height="200px" className="w-full" />
      </div>
    );
  }

  if (error || !mod) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <AlertCircle size={40} className="text-error mx-auto mb-4" />
          <p className="text-text-secondary mb-4">{error || t("learn.moduleNotFound")}</p>
          <Link
            href="/"
            className="inline-block bg-primary hover:bg-primary-hover text-white font-bold py-2.5 px-6 rounded-xl transition-colors active:scale-95 transition-transform duration-100"
          >
            {t("learn.goHome")}
          </Link>
        </div>
      </div>
    );
  }

  const mastered = mod.flashcards.filter((c) => c.interval_days > 21).length;

  const tabs: { key: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: "summary", label: t("learn.summary"), icon: BookOpen },
    { key: "flashcards", label: t("learn.flashcards"), icon: Layers, count: mod.flashcards.length },
    { key: "quiz", label: t("learn.quiz"), icon: HelpCircle, count: mod.quiz_questions.length },
    { key: "progress", label: t("learn.progress"), icon: BarChart3 },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen px-4 sm:px-6 py-4 sm:py-6 max-w-3xl mx-auto">
        <AutoSharePrompt
          show={showAutoShare}
          onShare={() => { setShowAutoShare(false); openShareFromQuiz(); }}
          onDismiss={() => setShowAutoShare(false)}
        />

        {showSnapshot && (
          <ShareableSnapshot
            moduleTitle={mod.title}
            sourceType={mod.source_type as "youtube" | "article"}
            totalCards={mod.flashcards.length}
            masteredCards={mastered}
            quizScore={snapshotQuizScore}
            onClose={() => setShowSnapshot(false)}
          />
        )}

        {/* Top bar */}
        <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Link
            href="/modules"
            className="text-text-secondary hover:text-text-primary transition-colors active:scale-95 transition-transform duration-100"
            aria-label={t("common.back")}
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-base sm:text-xl tracking-tight truncate flex-1">{mod.title}</h1>
          <span className="glass rounded-full px-2 sm:px-3 py-1 text-xs text-text-secondary hidden sm:flex items-center gap-1.5 shrink-0">
            {(() => { const SIcon = getSourceIcon(mod.source_type as SourceType); const sColor = getSourceColor(mod.source_type as SourceType); return <SIcon size={12} className={sColor} />; })()}
            {t(`sources.${mod.source_type}`)}
          </span>
          <span className="text-xs text-text-muted shrink-0">
            {mastered}/{mod.flashcards.length}
          </span>
          <LanguagePicker compact />
        </div>

        {/* Tabs */}
        <div className="glass rounded-lg flex mb-4 sm:mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                lightTap();
                if (tab.key === "quiz") handleQuizTabStart();
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 text-xs sm:text-sm transition-colors relative active:scale-95 transition-transform duration-100 ${
                activeTab === tab.key
                  ? "text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <tab.icon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count !== undefined && (
                <span className="bg-surface-hover text-text-muted text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
              {activeTab === tab.key && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-primary"
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {activeTab === "summary" && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="bg-surface rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
                <p className="text-text-primary text-base sm:text-lg leading-relaxed whitespace-pre-line">{mod.summary}</p>
              </div>

              {/* Explain Again */}
              <div className="mb-4 sm:mb-6">
                <p className="text-text-muted text-xs font-semibold mb-2">{t("learn.explainAgain")}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExplainAgain("simplify")}
                    disabled={explainLoading}
                    className="flex-1 glass hover:bg-surface-hover text-text-secondary font-semibold py-2 px-3 rounded-xl transition-colors active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-1.5 text-xs sm:text-sm disabled:opacity-50"
                  >
                    <Minimize2 size={14} /> {t("learn.simplify")}
                  </button>
                  <button
                    onClick={() => handleExplainAgain("analogy")}
                    disabled={explainLoading}
                    className="flex-1 glass hover:bg-surface-hover text-text-secondary font-semibold py-2 px-3 rounded-xl transition-colors active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-1.5 text-xs sm:text-sm disabled:opacity-50"
                  >
                    <Lightbulb size={14} /> {t("learn.analogy")}
                  </button>
                  <button
                    onClick={() => handleExplainAgain("real_world")}
                    disabled={explainLoading}
                    className="flex-1 glass hover:bg-surface-hover text-text-secondary font-semibold py-2 px-3 rounded-xl transition-colors active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-1.5 text-xs sm:text-sm disabled:opacity-50"
                  >
                    <GlobeIcon size={14} /> {t("learn.realWorld")}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {explainLoading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 sm:mb-6"
                  >
                    <div className="glass rounded-xl p-4 flex items-center justify-center gap-2 text-text-secondary text-sm">
                      <Loader2 size={16} className="animate-spin" />
                      {t("common.loading")}
                    </div>
                  </motion.div>
                )}
                {altExplanation && !explainLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 sm:mb-6"
                  >
                    <div className="glass rounded-xl p-4 sm:p-6 border-s-4 border-violet-500 relative">
                      <button
                        onClick={() => setAltExplanation(null)}
                        className="absolute top-3 end-3 text-text-muted hover:text-text-primary transition-colors"
                      >
                        <X size={16} />
                      </button>
                      <p className="text-text-primary text-sm sm:text-base leading-relaxed whitespace-pre-line pe-6">{altExplanation}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-3">
                <button
                  onClick={startSmartReview}
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-3 px-4 sm:px-6 rounded-xl transition-colors active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <Layers size={18} />
                  {t("learn.startFlashcards")}
                </button>
                <button
                  onClick={() => setActiveTab("quiz")}
                  className="flex-1 border border-primary text-primary hover:bg-primary hover:text-white font-bold py-3 px-4 sm:px-6 rounded-xl transition-colors active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <HelpCircle size={18} />
                  {t("learn.takeQuiz")}
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === "flashcards" && (
            <motion.div
              key="flashcards"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {(() => {
                const deck = studyCards || mod.flashcards;
                if (showFlashcardResume && pendingResumeSession) {
                  return (
                    <ResumePrompt
                      sessionType="flashcards"
                      current={pendingResumeSession.cards_reviewed}
                      total={deck.length}
                      onResume={handleFlashcardResume}
                      onStartOver={handleFlashcardStartOver}
                    />
                  );
                }
                if (deck.length === 0) {
                  return (
                    <div className="bg-surface rounded-xl p-6 text-center">
                      <p className="text-text-secondary text-sm">{t("flashcard.noCards")}</p>
                    </div>
                  );
                }
                if (deckComplete) {
                  return (
                    <DeckComplete
                      cardsReviewed={cardsReviewed}
                      onReviewAgain={resetDeck}
                      onTakeQuiz={() => { resetQuiz(); setActiveTab("quiz"); }}
                      onShare={openShareFromDeck}
                    />
                  );
                }
                return (
                  <FlashcardView
                    card={deck[cardIndex]}
                    index={cardIndex}
                    total={deck.length}
                    isFlipped={isFlipped}
                    showRating={showRating}
                    hasFlippedOnce={hasFlippedOnce}
                    direction={cardDirection}
                    onFlip={handleFlip}
                    onRate={handleRate}
                    isRTL={isRTL}
                  />
                );
              })()}
            </motion.div>
          )}

          {activeTab === "quiz" && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {showQuizResume && pendingResumeSession ? (
                <ResumePrompt
                  sessionType="quiz"
                  current={pendingResumeSession.questions_answered}
                  total={mod.quiz_questions.length}
                  onResume={handleQuizResume}
                  onStartOver={handleQuizStartOver}
                />
              ) : quizComplete ? (
                <QuizResults
                  score={quizScore}
                  total={mod.quiz_questions.length}
                  onRetake={resetQuiz}
                  onReviewFlashcards={() => { resetDeck(); setActiveTab("flashcards"); }}
                  onShare={openShareFromQuiz}
                />
              ) : (
                <QuizView
                  question={mod.quiz_questions[quizIndex]}
                  index={quizIndex}
                  total={mod.quiz_questions.length}
                  selectedAnswer={selectedAnswer}
                  onSelect={handleQuizAnswer}
                  onNext={nextQuestion}
                />
              )}
            </motion.div>
          )}

          {activeTab === "progress" && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ProgressDashboard
                moduleId={moduleId}
                moduleTitle={mod.title}
                sourceType={mod.source_type}
                totalFlashcards={mod.flashcards.length}
                totalQuizQuestions={mod.quiz_questions.length}
                refreshKey={progressKey}
                onStartReview={startSmartReview}
                onTakeQuiz={() => { resetQuiz(); setActiveTab("quiz"); }}
                onShare={openShareFromDeck}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}

/* ─── Flashcard with swipe ─── */

function FlashcardView({
  card,
  index,
  total,
  isFlipped,
  showRating,
  hasFlippedOnce,
  direction,
  onFlip,
  onRate,
}: {
  card: Flashcard;
  index: number;
  total: number;
  isFlipped: boolean;
  showRating: boolean;
  hasFlippedOnce: boolean;
  direction: "left" | "right" | "up" | null;
  onFlip: () => void;
  onRate: (q: number) => void;
  isRTL: boolean;
}) {
  const { t } = useLocale();

  // Color flash feedback when rating
  const exitBg = direction === "right" ? "bg-success/20" : direction === "left" ? "bg-error/20" : direction === "up" ? "bg-warning/20" : "";

  return (
    /* Viewport Container — fixed height, flex-centered */
    <div className="w-full min-h-[400px] sm:min-h-[480px] flex flex-col items-center justify-center">
      <p className="text-text-muted text-sm mb-3 sm:mb-4">
        {t("flashcard.cardOf", { current: index + 1, total })}
      </p>

      {/* Perspective wrapper — stable 3D context */}
      <div className="w-full flex justify-center items-center" style={{ perspective: 1000 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`card-${index}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-xl mx-auto"
          >
            {/* Inner card — rotates on Y axis, front/back stacked */}
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              onClick={onFlip}
              className={`relative w-full cursor-pointer select-none rounded-2xl ${exitBg}`}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Front face (Question) */}
              <div
                className="glass rounded-2xl w-full aspect-[4/3] flex items-center justify-center p-6 sm:p-8 overflow-hidden"
                style={{ backfaceVisibility: "hidden" }}
              >
                <p className="text-lg sm:text-xl font-bold text-text-primary text-center">{card.front}</p>
              </div>

              {/* Back face (Answer) — absolute, pre-rotated 180deg */}
              <div
                className="glass rounded-2xl w-full aspect-[4/3] flex items-center justify-center p-6 sm:p-8 overflow-hidden absolute inset-0"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <p className="text-base sm:text-lg font-semibold text-text-secondary text-center">{card.back}</p>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {!hasFlippedOnce && (
        <p className="text-text-muted text-xs mt-3">{t("flashcard.tapToFlip")}</p>
      )}

      <AnimatePresence>
        {showRating && isFlipped && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-6 w-full sm:w-auto"
          >
            <button
              onClick={(e) => { e.stopPropagation(); onRate(1); }}
              className="bg-error hover:opacity-80 text-white font-bold py-3 px-6 rounded-xl transition-opacity active:scale-95 transition-transform duration-100 flex items-center justify-center gap-2"
            >
              <Frown size={18} /> {t("flashcard.hard")}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRate(3); }}
              className="bg-warning hover:opacity-80 text-white font-bold py-3 px-6 rounded-xl transition-opacity active:scale-95 transition-transform duration-100 flex items-center justify-center gap-2"
            >
              <Meh size={18} /> {t("flashcard.good")}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRate(5); }}
              className="bg-success hover:opacity-80 text-white font-bold py-3 px-6 rounded-xl transition-opacity active:scale-95 transition-transform duration-100 flex items-center justify-center gap-2"
            >
              <Smile size={18} /> {t("flashcard.easy")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Deck Complete ─── */

function DeckComplete({
  cardsReviewed,
  onReviewAgain,
  onTakeQuiz,
  onShare,
}: {
  cardsReviewed: number;
  onReviewAgain: () => void;
  onTakeQuiz: () => void;
  onShare: () => void;
}) {
  const { t } = useLocale();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center py-8 sm:py-12"
    >
      <div className="rounded-full bg-success/20 p-4 mb-4">
        <Check size={40} className="text-success" />
      </div>
      <h2 className="text-xl sm:text-2xl mb-2">{t("flashcard.deckComplete")}</h2>
      <p className="text-text-secondary mb-6 sm:mb-8">{t("flashcard.cardsReviewed", { count: cardsReviewed })}</p>
      <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 w-full sm:w-auto">
        <button
          onClick={onReviewAgain}
          className="border border-primary text-primary hover:bg-primary hover:text-white font-bold py-3 px-6 rounded-xl transition-colors active:scale-95 transition-transform duration-100 flex items-center justify-center gap-2"
        >
          <RotateCcw size={18} /> {t("flashcard.reviewAgain")}
        </button>
        <button
          onClick={onTakeQuiz}
          className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-xl transition-colors active:scale-95 transition-transform duration-100 flex items-center justify-center gap-2"
        >
          <HelpCircle size={18} /> {t("learn.takeQuiz")}
        </button>
        <button
          onClick={onShare}
          className="glass hover:bg-surface-hover text-text-secondary hover:text-text-primary font-bold py-3 px-6 rounded-xl transition-colors active:scale-95 transition-transform duration-100 flex items-center justify-center gap-2"
        >
          <Share2 size={18} /> {t("progressDashboard.shareProgress")}
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Quiz View ─── */

function QuizView({
  question,
  index,
  total,
  selectedAnswer,
  onSelect,
  onNext,
}: {
  question: { question: string; options: string[]; option_feedbacks: string[] | null; correct_answer: number; explanation: string };
  index: number;
  total: number;
  selectedAnswer: number | null;
  onSelect: (idx: number) => void;
  onNext: () => void;
}) {
  const { t } = useLocale();
  const labels = ["A", "B", "C", "D"];
  const answered = selectedAnswer !== null;
  const isCorrect = selectedAnswer === question.correct_answer;

  return (
    <div>
      <p className="text-text-muted text-sm mb-3 sm:mb-4 text-center">
        {t("quiz.questionOf", { current: index + 1, total })}
      </p>

      <div className="glass rounded-2xl p-4 sm:p-6 mb-4">
        <p className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">{question.question}</p>

        <div className="space-y-2 sm:space-y-3">
          {question.options.map((opt, i) => {
            let style = "bg-surface hover:bg-surface-hover";
            if (answered) {
              if (i === question.correct_answer) style = "bg-success/20 border-success";
              else if (i === selectedAnswer) style = "bg-error/20 border-error";
              else style = "bg-surface opacity-50";
            }
            const feedback = answered && question.option_feedbacks?.[i];
            return (
              <div key={i}>
                <button
                  onClick={() => onSelect(i)}
                  disabled={answered}
                  className={`w-full text-start rounded-xl p-3 sm:p-4 min-h-[52px] font-semibold flex items-center gap-3 transition-colors border border-transparent active:scale-[0.98] transition-transform duration-100 ${style} disabled:cursor-default`}
                >
                  <span className="w-7 h-7 rounded-full bg-primary text-white text-xs flex items-center justify-center shrink-0 font-bold">
                    {labels[i]}
                  </span>
                  <span className="flex-1 text-sm sm:text-base">{opt}</span>
                  {answered && i === question.correct_answer && (
                    <Check size={18} className="text-success ms-auto shrink-0" />
                  )}
                </button>
                {feedback && (
                  <p className={`text-xs px-4 pb-2 pt-1 ${
                    i === question.correct_answer ? "text-success" : "text-text-muted"
                  }`}>
                    {feedback}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {answered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className={`glass rounded-xl p-4 mb-4 border-s-4 ${
                isCorrect ? "border-success" : "border-error"
              }`}
            >
              <p className="text-text-secondary text-sm">{question.explanation}</p>
            </div>
            <button
              onClick={onNext}
              className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl transition-colors active:scale-[0.98] transition-transform duration-100"
            >
              {t("quiz.nextQuestion")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Quiz Results ─── */

function QuizResults({
  score,
  total,
  onRetake,
  onReviewFlashcards,
  onShare,
}: {
  score: number;
  total: number;
  onRetake: () => void;
  onReviewFlashcards: () => void;
  onShare: () => void;
}) {
  const { t } = useLocale();
  const pct = Math.round((score / total) * 100);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pct / 100) * circumference;

  let accent: string, message: string;
  if (pct >= 80) {
    accent = "text-success";
    message = t("quiz.excellent");
  } else if (pct >= 50) {
    accent = "text-warning";
    message = t("quiz.good");
  } else {
    accent = "text-error";
    message = t("quiz.needsWork");
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center py-6 sm:py-8"
    >
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#2f2f2d" strokeWidth="8" />
          <motion.circle
            cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8"
            strokeLinecap="round" strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={accent}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-2xl sm:text-3xl font-[800] ${accent}`}>
          {pct}%
        </span>
      </div>

      <p className="text-lg sm:text-xl font-bold mb-1">
        {t("quiz.score", { correct: score, total })}
      </p>
      <p className="text-text-secondary text-sm mb-6 sm:mb-8 text-center max-w-sm">
        {message}
      </p>

      <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 w-full sm:w-auto">
        <button
          onClick={onRetake}
          className="border border-primary text-primary hover:bg-primary hover:text-white font-bold py-3 px-6 rounded-xl transition-colors active:scale-95 transition-transform duration-100 flex items-center justify-center gap-2"
        >
          <RotateCcw size={18} /> {t("quiz.retakeQuiz")}
        </button>
        <button
          onClick={onReviewFlashcards}
          className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-xl transition-colors active:scale-95 transition-transform duration-100 flex items-center justify-center gap-2"
        >
          <Layers size={18} /> {t("quiz.reviewFlashcards")}
        </button>
        <button
          onClick={onShare}
          className="glass hover:bg-surface-hover text-text-secondary hover:text-text-primary font-bold py-3 px-6 rounded-xl transition-colors active:scale-95 transition-transform duration-100 flex items-center justify-center gap-2"
        >
          <Share2 size={18} /> {t("quiz.shareResults")}
        </button>
      </div>
    </motion.div>
  );
}
