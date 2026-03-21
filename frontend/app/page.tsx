"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Brain,
  CheckCircle,
  RotateCcw,
  Loader2,
  AlertCircle,
  Layers,
  HelpCircle,
  BookOpen,
  Plus,
  Lightbulb,
  Link as LinkIcon,
} from "lucide-react";
import Link from "next/link";
import { generateModule, generateFromTopic, getModules, LearningModule, LearningModuleListItem, GenerateOptions, Difficulty } from "@/lib/api";
import { getSourceIcon, getSourceColor } from "@/lib/sourceIcons";
import ProcessingAnimation from "@/components/ProcessingAnimation";
import PageTransition from "@/components/PageTransition";
import { useLocale } from "@/lib/LocaleContext";

export default function Home() {
  const router = useRouter();
  const { t } = useLocale();
  const [inputUrl, setInputUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const [recentModules, setRecentModules] = useState<LearningModuleListItem[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [genFlashcards, setGenFlashcards] = useState(true);
  const [genQuiz, setGenQuiz] = useState(true);
  const [inputMode, setInputMode] = useState<"url" | "topic">("topic");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");

  const apiResultRef = useRef<LearningModule | null>(null);
  const apiDoneRef = useRef(false);
  const animDoneRef = useRef(false);
  const apiErrorRef = useRef<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    getModules()
      .then((mods) => setRecentModules(mods.slice(0, 3)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const tryNavigate = useCallback(() => {
    if (apiDoneRef.current && animDoneRef.current && apiResultRef.current) {
      router.push(`/learn/${apiResultRef.current.id}`);
    } else if (apiErrorRef.current && animDoneRef.current) {
      setShowAnimation(false);
      setIsLoading(false);
      setError(apiErrorRef.current);
      apiErrorRef.current = null;
      animDoneRef.current = false;
      apiDoneRef.current = false;
    }
  }, [router]);

  const handleContinueToOptions = () => {
    if (!inputUrl.trim()) return;
    setShowOptions(true);
  };

  const handleGenerate = async () => {
    if (!inputUrl.trim()) return;
    setShowOptions(false);
    setIsLoading(true);
    setError(null);
    apiResultRef.current = null;
    apiDoneRef.current = false;
    animDoneRef.current = false;
    apiErrorRef.current = null;
    setFinalizing(false);
    setShowAnimation(true);

    const options: GenerateOptions = {
      generateFlashcards: genFlashcards,
      generateQuiz: genQuiz,
    };

    try {
      const result = inputMode === "topic"
        ? await generateFromTopic(inputUrl.trim(), difficulty, options)
        : await generateModule(inputUrl.trim(), options);
      apiResultRef.current = result;
      apiDoneRef.current = true;
      tryNavigate();
    } catch (err: unknown) {
      let msg = t("common.error");
      if (err && typeof err === "object" && "message" in err) {
        msg = (err as { message: string }).message || t("common.error");
      }
      apiErrorRef.current = msg;
      apiDoneRef.current = true;
      tryNavigate();
    }
  };

  const handleAnimationComplete = useCallback(() => {
    animDoneRef.current = true;
    if (apiDoneRef.current) {
      tryNavigate();
    } else {
      setFinalizing(true);
    }
  }, [tryNavigate]);

  useEffect(() => {
    if (!finalizing) return;
    const interval = setInterval(() => {
      if (apiDoneRef.current) {
        setFinalizing(false);
        tryNavigate();
      }
    }, 300);
    return () => clearInterval(interval);
  }, [finalizing, tryNavigate]);

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col">
        <ProcessingAnimation
          isActive={showAnimation}
          onComplete={handleAnimationComplete}
        />

        {/* Hero */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-12 sm:pb-20 pt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl"
          >
            <h1 className="text-2xl sm:text-3xl lg:text-5xl tracking-tight mb-3 sm:mb-4">
              {t("hero.title")}
            </h1>
            <p className="text-text-secondary text-base sm:text-lg max-w-2xl mx-auto mb-6 sm:mb-8 px-2">
              {t("hero.subtitle")}
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8 sm:mb-10">
              <span className="glass rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-text-secondary flex items-center gap-2">
                <Brain size={14} className="text-primary" />
                {t("hero.featureFlashcards")}
              </span>
              <span className="glass rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-text-secondary flex items-center gap-2">
                <CheckCircle size={14} className="text-primary" />
                {t("hero.featureQuizzes")}
              </span>
              <span className="glass rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-text-secondary flex items-center gap-2">
                <RotateCcw size={14} className="text-primary" />
                {t("hero.featureSpaced")}
              </span>
            </div>
          </motion.div>

          {/* Apple-style Input Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full max-w-xl lg:max-w-2xl"
          >
            {/* Mode toggle */}
            <div className="flex items-center justify-center gap-1 mb-3">
              <button
                onClick={() => { setInputMode("topic"); setInputUrl(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  inputMode === "topic" ? "bg-violet-500/20 text-violet-400" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <Lightbulb size={12} /> {t("newModal.topic")}
              </button>
              <button
                onClick={() => { setInputMode("url"); setInputUrl(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  inputMode === "url" ? "bg-primary/20 text-primary" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <LinkIcon size={12} /> URL
              </button>
            </div>

            <motion.div
              whileTap={{ scale: 0.995 }}
              className={`glass rounded-full flex items-center gap-2 px-2 py-2 ${
                isLoading ? "glow-border-fast" : "glow-border"
              }`}
              style={{
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              {/* + Button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => window.dispatchEvent(new CustomEvent("open-new-module-modal"))}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-surface-hover hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors"
                aria-label="More options"
              >
                <Plus size={18} className="text-text-secondary" />
              </motion.button>

              {/* Input */}
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !isLoading && handleContinueToOptions()
                }
                disabled={isLoading}
                placeholder={inputMode === "topic" ? t("newModal.topicPlaceholder") : t("hero.inputPlaceholder")}
                className="flex-1 min-w-0 bg-transparent text-sm sm:text-base text-text-primary placeholder-text-muted outline-none disabled:opacity-50 px-1"
              />

              {/* Generate Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleContinueToOptions}
                disabled={isLoading || !inputUrl.trim()}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:hover:bg-primary flex items-center justify-center shrink-0 transition-colors"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <Sparkles size={16} className="text-white" />
                )}
              </motion.button>
            </motion.div>

            {/* Suggestion chips (topic mode only) */}
            <AnimatePresence>
              {inputMode === "topic" && !inputUrl && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex flex-wrap items-center justify-center gap-2 mt-3"
                >
                  {["Quantum Physics", "Making Sourdough", "Next.js Basics"].map((chip, i) => (
                    <motion.button
                      key={chip}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * i }}
                      onClick={() => setInputUrl(chip)}
                      className="glass rounded-full px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors"
                    >
                      Try: {chip}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Difficulty selector (topic mode with input) */}
            <AnimatePresence>
              {inputMode === "topic" && inputUrl.trim() && !isLoading && !showOptions && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center justify-center gap-2 mt-3"
                >
                  {(["beginner", "intermediate", "advanced"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        difficulty === d
                          ? "bg-primary/20 text-primary"
                          : "text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      {t(`newModal.${d}`)}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center justify-center gap-2 text-error text-sm"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}

            {/* Generation Options Overlay */}
            <AnimatePresence>
              {showOptions && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                  onClick={() => setShowOptions(false)}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", damping: 22, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 sm:p-6"
                  >
                    <h3 className="text-lg font-[800] text-text-primary mb-4">
                      {t("generateOptions.title")}
                    </h3>
                    <div className="space-y-3 mb-4">
                      <div className="bg-background rounded-xl p-4 border border-border flex items-center gap-3 opacity-60">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                          <BookOpen size={20} className="text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-[700] text-text-primary text-sm">{t("generateOptions.summary")}</p>
                          <p className="text-text-muted text-xs">{t("generateOptions.alwaysIncluded")}</p>
                        </div>
                        <div className="w-10 h-6 rounded-full bg-primary flex items-center justify-end px-0.5 shrink-0">
                          <div className="w-5 h-5 rounded-full bg-white" />
                        </div>
                      </div>
                      <button
                        onClick={() => setGenFlashcards(!genFlashcards)}
                        className={`w-full rounded-xl p-4 border flex items-center gap-3 transition-colors text-start ${
                          genFlashcards ? "bg-primary/10 border-primary" : "bg-background border-border"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${genFlashcards ? "bg-primary/20" : "bg-surface-hover"}`}>
                          <Layers size={20} className={genFlashcards ? "text-primary" : "text-text-muted"} />
                        </div>
                        <p className={`flex-1 font-[700] text-sm ${genFlashcards ? "text-text-primary" : "text-text-secondary"}`}>
                          {t("generateOptions.flashcards")}
                        </p>
                        <div className={`w-10 h-6 rounded-full flex items-center px-0.5 shrink-0 transition-colors ${genFlashcards ? "bg-primary justify-end" : "bg-surface-hover justify-start"}`}>
                          <div className="w-5 h-5 rounded-full bg-white" />
                        </div>
                      </button>
                      <button
                        onClick={() => setGenQuiz(!genQuiz)}
                        className={`w-full rounded-xl p-4 border flex items-center gap-3 transition-colors text-start ${
                          genQuiz ? "bg-primary/10 border-primary" : "bg-background border-border"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${genQuiz ? "bg-primary/20" : "bg-surface-hover"}`}>
                          <HelpCircle size={20} className={genQuiz ? "text-primary" : "text-text-muted"} />
                        </div>
                        <p className={`flex-1 font-[700] text-sm ${genQuiz ? "text-text-primary" : "text-text-secondary"}`}>
                          {t("generateOptions.quiz")}
                        </p>
                        <div className={`w-10 h-6 rounded-full flex items-center px-0.5 shrink-0 transition-colors ${genQuiz ? "bg-primary justify-end" : "bg-surface-hover justify-start"}`}>
                          <div className="w-5 h-5 rounded-full bg-white" />
                        </div>
                      </button>
                    </div>
                    <button
                      onClick={handleGenerate}
                      className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-xl transition-colors active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-2"
                    >
                      <Sparkles size={18} />
                      {t("generateOptions.generate")}
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </main>

        {/* Recent Modules */}
        {recentModules.length > 0 && (
          <section className="px-4 sm:px-6 pb-12 max-w-3xl mx-auto w-full">
            <h2 className="text-lg sm:text-xl mb-4">{t("modules.continueLearning")}</h2>
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-none">
              {recentModules.map((mod) => (
                <Link
                  key={mod.id}
                  href={`/learn/${mod.id}`}
                  className="glass rounded-xl p-4 min-w-[200px] sm:min-w-[220px] flex-shrink-0 hover:bg-surface-hover transition-colors active:scale-[0.98] transition-transform duration-100"
                >
                  <div className="flex items-center gap-1.5 text-text-muted text-xs mb-2">
                    {(() => { const Icon = getSourceIcon(mod.source_type); const color = getSourceColor(mod.source_type); return <Icon size={10} className={color} />; })()}
                    {t(`sources.${mod.source_type}`)}
                  </div>
                  <p className="font-bold text-sm text-text-primary truncate mb-2">
                    {mod.title}
                  </p>
                  <span className="text-primary text-xs font-semibold">
                    {t("modules.continueLabel")}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center text-text-muted text-xs py-6">
          {t("footer.tagline")}
        </footer>
      </div>
    </PageTransition>
  );
}
