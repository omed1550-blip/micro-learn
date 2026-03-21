"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowLeft, Sparkles, Loader2, AlertCircle, Upload,
  Youtube, Globe, PenLine, Camera, FileText, File,
  Layers, HelpCircle, BookOpen, Lightbulb, Check,
} from "lucide-react";
import { generateModule, generateFromNotes, generateFromFile, generateFromTopic } from "@/lib/api";
import { useLocale } from "@/lib/LocaleContext";
import type { SourceType, GenerateOptions, Difficulty } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onModuleCreated?: () => void;
}

type InputSource = SourceType | null;
type Step = "source" | "input" | "options" | "difficulty";

const SOURCE_OPTIONS: { type: SourceType; icon: typeof Youtube; color: string }[] = [
  { type: "topic", icon: Lightbulb, color: "text-violet-500" },
  { type: "youtube", icon: Youtube, color: "text-red-500" },
  { type: "article", icon: Globe, color: "text-primary" },
  { type: "notes", icon: PenLine, color: "text-warning" },
  { type: "image", icon: Camera, color: "text-success" },
  { type: "pdf", icon: FileText, color: "text-error" },
  { type: "document", icon: File, color: "text-primary" },
];

export default function NewModuleModal({ isOpen, onClose, onModuleCreated }: Props) {
  const router = useRouter();
  const { t } = useLocale();
  const [selected, setSelected] = useState<InputSource>(null);
  const [step, setStep] = useState<Step>("source");
  const [url, setUrl] = useState("");
  const [notesTitle, setNotesTitle] = useState("");
  const [notesContent, setNotesContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genFlashcards, setGenFlashcards] = useState(true);
  const [genQuiz, setGenQuiz] = useState(true);
  const [topicInput, setTopicInput] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setSelected(null);
    setStep("source");
    setUrl("");
    setNotesTitle("");
    setNotesContent("");
    setFile(null);
    setError(null);
    setLoading(false);
    setDragOver(false);
    setGenFlashcards(true);
    setGenQuiz(true);
    setTopicInput("");
    setDifficulty("beginner");
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleContinueToOptions = () => {
    setError(null);
    if (selected === "topic") {
      if (!topicInput.trim()) { setError("Topic is required"); return; }
    } else if (selected === "youtube" || selected === "article") {
      if (!url.trim()) { setError("URL is required"); return; }
    } else if (selected === "notes") {
      if (notesContent.length < 10) { setError(t("newModal.minChars")); return; }
    } else if (selected === "image" || selected === "pdf" || selected === "document") {
      if (!file) { setError("No file selected"); return; }
      if (file.size > 20 * 1024 * 1024) { setError(t("newModal.fileTooLarge")); return; }
    } else {
      setError("No input provided"); return;
    }
    setStep("options");
  };

  const handleGenerate = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);

    const options: GenerateOptions = {
      generateFlashcards: genFlashcards,
      generateQuiz: genQuiz,
    };

    try {
      let result;
      if (selected === "topic") {
        result = await generateFromTopic(topicInput.trim(), difficulty, options);
      } else if (selected === "youtube" || selected === "article") {
        result = await generateModule(url.trim(), options);
      } else if (selected === "notes") {
        result = await generateFromNotes(notesTitle || "Untitled Notes", notesContent, options);
      } else if (file) {
        result = await generateFromFile(file, options);
      } else {
        setError("No input provided");
        setLoading(false);
        return;
      }

      handleClose();
      onModuleCreated?.();
      router.push(`/learn/${result.id}`);
    } catch (err: unknown) {
      let msg = t("common.error");
      if (err && typeof err === "object" && "message" in err) {
        msg = (err as { message: string }).message || msg;
      }
      setError(msg);
      setLoading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  };

  const validateAndSetFile = (f: File) => {
    if (f.size > 20 * 1024 * 1024) {
      setError(t("newModal.fileTooLarge"));
      return;
    }
    setFile(f);
    setError(null);
  };

  const getAccept = () => {
    if (selected === "image") return "image/jpeg,image/png,image/webp,image/gif";
    if (selected === "pdf") return ".pdf";
    return ".docx,.doc,.txt,.md,.rtf";
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleBack = () => {
    setError(null);
    if (step === "difficulty") {
      setStep("options");
    } else if (step === "options") {
      setStep("input");
    } else if (step === "input") {
      setSelected(null);
      setStep("source");
      setFile(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              {step !== "source" && (
                <button
                  onClick={handleBack}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <div>
                <h2 className="text-xl font-[800] text-text-primary">
                  {step === "options" ? t("generateOptions.title") : step === "difficulty" ? t("newModal.difficulty") : t("newModal.title")}
                </h2>
                <p className="text-text-secondary text-sm mt-0.5">
                  {step === "options" || step === "difficulty" ? "" : t("newModal.subtitle")}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-text-secondary hover:text-text-primary transition-colors p-1"
            >
              <X size={20} />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {step === "source" && (
              /* Source Grid */
              <motion.div
                key="grid"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-3"
              >
                {SOURCE_OPTIONS.map(({ type, icon: Icon, color }) => (
                  <button
                    key={type}
                    onClick={() => { setSelected(type); setStep("input"); }}
                    className="bg-background rounded-xl p-4 border border-border hover:border-primary transition-all text-start active:scale-[0.97] transition-transform duration-100 group"
                  >
                    <Icon size={24} className={`${color} mb-2`} />
                    <p className="font-[700] text-text-primary text-sm">
                      {t(`newModal.${type}`)}
                    </p>
                    <p className="text-text-muted text-xs mt-0.5">
                      {t(`newModal.${type}Sub`)}
                    </p>
                  </button>
                ))}
              </motion.div>
            )}

            {step === "input" && (
              /* Input Form */
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {/* Topic Input */}
                {selected === "topic" && (
                  <>
                    <input
                      type="text"
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleContinueToOptions()}
                      placeholder={t("newModal.topicPlaceholder")}
                      disabled={loading}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted outline-none focus:border-primary transition-colors disabled:opacity-50"
                    />
                  </>
                )}

                {/* URL Input */}
                {(selected === "youtube" || selected === "article") && (
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleContinueToOptions()}
                    placeholder={t("newModal.urlPlaceholder")}
                    disabled={loading}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted outline-none focus:border-primary transition-colors disabled:opacity-50"
                  />
                )}

                {/* Notes Form */}
                {selected === "notes" && (
                  <>
                    <input
                      type="text"
                      value={notesTitle}
                      onChange={(e) => setNotesTitle(e.target.value)}
                      placeholder={t("newModal.notesTitle")}
                      disabled={loading}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted outline-none focus:border-primary transition-colors disabled:opacity-50"
                    />
                    <div className="relative">
                      <textarea
                        value={notesContent}
                        onChange={(e) => setNotesContent(e.target.value)}
                        placeholder={t("newModal.notesContent")}
                        disabled={loading}
                        rows={6}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted outline-none focus:border-primary transition-colors resize-none disabled:opacity-50"
                      />
                      <span className="absolute bottom-3 end-3 text-text-muted text-xs">
                        {notesContent.length}
                      </span>
                    </div>
                  </>
                )}

                {/* File Upload */}
                {(selected === "image" || selected === "pdf" || selected === "document") && (
                  <>
                    {!file ? (
                      <div
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                          dragOver ? "border-primary bg-primary/5" : "border-border"
                        }`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleFileDrop}
                      >
                        {selected === "image" ? (
                          <Camera size={32} className="text-text-muted mx-auto mb-3" />
                        ) : selected === "pdf" ? (
                          <FileText size={32} className="text-text-muted mx-auto mb-3" />
                        ) : (
                          <Upload size={32} className="text-text-muted mx-auto mb-3" />
                        )}
                        <p className="text-text-secondary text-sm mb-1">
                          {selected === "image" && t("newModal.dragDropImage")}
                          {selected === "pdf" && t("newModal.dragDropPdf")}
                          {selected === "document" && t("newModal.dragDropDoc")}
                        </p>
                        <p className="text-text-muted text-xs">
                          {selected === "image" && t("newModal.supportedImages")}
                          {selected === "document" && t("newModal.supportedDocs")}
                          {" "}{t("newModal.maxSize")}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-background border border-border rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          {selected === "image" ? <Camera size={18} className="text-success shrink-0" /> :
                           selected === "pdf" ? <FileText size={18} className="text-error shrink-0" /> :
                           <File size={18} className="text-primary shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-sm text-text-primary truncate">{file.name}</p>
                            <p className="text-xs text-text-muted">{formatSize(file.size)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setFile(null)}
                          className="text-text-secondary hover:text-text-primary transition-colors p-1 shrink-0"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={getAccept()}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) validateAndSetFile(f);
                      }}
                    />
                  </>
                )}

                {/* Continue Button */}
                <button
                  onClick={handleContinueToOptions}
                  disabled={
                    selected === "topic" ? !topicInput.trim() :
                    (selected === "youtube" || selected === "article") ? !url.trim() :
                    selected === "notes" ? notesContent.length < 10 :
                    !file
                  }
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:hover:bg-primary text-white font-bold py-3 px-6 rounded-xl transition-colors active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-2"
                >
                  <Sparkles size={18} />
                  {t("hero.generate")}
                </button>

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-error text-sm"
                  >
                    <AlertCircle size={16} />
                    {error}
                  </motion.div>
                )}
              </motion.div>
            )}

            {step === "options" && (
              /* Generation Options */
              <motion.div
                key="options"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="space-y-3">
                  {/* Summary — always on */}
                  <div className="bg-background rounded-xl p-4 border border-border flex items-center gap-3 opacity-60">
                    <div className="w-6 h-6 rounded-md border-2 bg-primary border-primary flex items-center justify-center shrink-0">
                      <Check size={14} className="text-white" />
                    </div>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                        <BookOpen size={20} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-[700] text-text-primary text-sm">{t("generateOptions.summary")}</p>
                        <p className="text-text-muted text-xs">{t("generateOptions.alwaysIncluded")}</p>
                      </div>
                    </div>
                  </div>

                  {/* Flashcards toggle */}
                  <button
                    onClick={() => setGenFlashcards(!genFlashcards)}
                    className={`w-full rounded-xl p-4 border flex items-center gap-3 transition-colors text-start ${
                      genFlashcards
                        ? "bg-primary/10 border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      genFlashcards
                        ? "bg-primary border-primary"
                        : "border-border"
                    }`}>
                      {genFlashcards && <Check size={14} className="text-white" />}
                    </div>
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        genFlashcards ? "bg-primary/20" : "bg-surface-hover"
                      }`}>
                        <Layers size={20} className={genFlashcards ? "text-primary" : "text-text-muted"} />
                      </div>
                      <p className={`font-[700] text-sm ${genFlashcards ? "text-text-primary" : "text-text-secondary"}`}>
                        {t("generateOptions.flashcards")}
                      </p>
                    </div>
                  </button>

                  {/* Quiz toggle */}
                  <button
                    onClick={() => setGenQuiz(!genQuiz)}
                    className={`w-full rounded-xl p-4 border flex items-center gap-3 transition-colors text-start ${
                      genQuiz
                        ? "bg-primary/10 border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      genQuiz
                        ? "bg-primary border-primary"
                        : "border-border"
                    }`}>
                      {genQuiz && <Check size={14} className="text-white" />}
                    </div>
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        genQuiz ? "bg-primary/20" : "bg-surface-hover"
                      }`}>
                        <HelpCircle size={20} className={genQuiz ? "text-primary" : "text-text-muted"} />
                      </div>
                      <p className={`font-[700] text-sm ${genQuiz ? "text-text-primary" : "text-text-secondary"}`}>
                        {t("generateOptions.quiz")}
                      </p>
                    </div>
                  </button>
                </div>

                {/* Continue / Generate Button */}
                <button
                  onClick={selected === "topic" ? () => setStep("difficulty") : handleGenerate}
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:hover:bg-primary text-white font-bold py-3 px-6 rounded-xl transition-colors active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      {t("newModal.analyzing")}
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      {selected === "topic" ? t("hero.generate") : t("generateOptions.generate")}
                    </>
                  )}
                </button>

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-error text-sm"
                  >
                    <AlertCircle size={16} />
                    {error}
                  </motion.div>
                )}
              </motion.div>
            )}

            {step === "difficulty" && (
              /* Difficulty Selection — topic only */
              <motion.div
                key="difficulty"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <p className="text-text-secondary text-sm">{t("newModal.difficulty")}</p>
                <div className="space-y-3">
                  {(["beginner", "intermediate", "advanced"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`w-full rounded-xl p-4 border flex items-center gap-3 transition-colors text-start ${
                        difficulty === d
                          ? "bg-primary/10 border-primary"
                          : "bg-background border-border hover:border-primary/50"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        difficulty === d
                          ? "bg-primary border-primary"
                          : "border-border"
                      }`}>
                        {difficulty === d && <Check size={14} className="text-white" />}
                      </div>
                      <p className={`font-[700] text-sm ${
                        difficulty === d ? "text-text-primary" : "text-text-secondary"
                      }`}>
                        {t(`newModal.${d}`)}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:hover:bg-primary text-white font-bold py-3 px-6 rounded-xl transition-colors active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      {t("newModal.analyzing")}
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      {t("generateOptions.generate")}
                    </>
                  )}
                </button>

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-error text-sm"
                  >
                    <AlertCircle size={16} />
                    {error}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
