"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  ArrowLeft, Plus, Play, MoreVertical, Pencil, Trash2,
  GripVertical, ArrowRight, Layers, BookOpen, Brain,
  Lightbulb, GraduationCap, Code, Globe, Music, Loader2,
} from "lucide-react";
import {
  getDeck, deleteDeck, createCard, updateCard, deleteCard,
  reorderCards, reviewManualCard, getDeckDueCards, getDeckProgress,
  getDeckStudyQueue, ManualDeck, ManualCard, Progress,
} from "@/lib/api";
import { useLocale } from "@/lib/LocaleContext";
import CardEditorModal from "@/components/CardEditorModal";
import ImageLightbox from "@/components/ImageLightbox";

const ICON_MAP: Record<string, React.ElementType> = {
  layers: Layers, "book-open": BookOpen, brain: Brain,
  lightbulb: Lightbulb, "graduation-cap": GraduationCap,
  code: Code, globe: Globe, music: Music,
};

type View = "list" | "study" | "progress";

export default function DeckPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  const { t } = useLocale();

  const [deck, setDeck] = useState<(ManualDeck & { cards: ManualCard[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("list");
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCardEditor, setShowCardEditor] = useState(false);
  const [editingCard, setEditingCard] = useState<ManualCard | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  // Study state
  const [studyCards, setStudyCards] = useState<ManualCard[]>([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [studyComplete, setStudyComplete] = useState(false);
  const [reviewingAll, setReviewingAll] = useState(false);

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const fetchDeck = useCallback(async () => {
    try {
      const data = await getDeck(deckId);
      setDeck(data);
    } catch {
      setError("Failed to load deck");
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  const fetchProgress = useCallback(async () => {
    try {
      const p = await getDeckProgress(deckId);
      setProgress(p);
    } catch { /* ignore */ }
  }, [deckId]);

  useEffect(() => {
    fetchDeck();
    fetchProgress();
  }, [fetchDeck, fetchProgress]);

  const handleDeleteDeck = async () => {
    await deleteDeck(deckId);
    router.push("/");
  };

  const handleSaveCard = async (data: {
    front_text: string;
    front_image: string | null;
    front_image_filename: string | null;
    back_text: string;
    back_image: string | null;
    back_image_filename: string | null;
  }) => {
    if (editingCard) {
      await updateCard(deckId, editingCard.id, data);
    } else {
      await createCard(deckId, data);
    }
    await fetchDeck();
    await fetchProgress();
  };

  const handleDeleteCard = async () => {
    if (!editingCard) return;
    await deleteCard(deckId, editingCard.id);
    await fetchDeck();
    await fetchProgress();
  };

  const handleReorder = async (newOrder: ManualCard[]) => {
    if (!deck) return;
    setDeck({ ...deck, cards: newOrder });
    const cardIds = newOrder.map((c) => c.id);
    await reorderCards(deckId, cardIds);
  };

  const startStudy = async (all: boolean) => {
    setReviewingAll(all);
    try {
      let cards: ManualCard[];
      if (all) {
        cards = await getDeckStudyQueue(deckId);
        if (cards.length === 0 && deck) {
          cards = deck.cards;
        }
      } else {
        cards = await getDeckDueCards(deckId);
      }
      if (cards.length === 0) {
        return;
      }
      setStudyCards(cards);
      setStudyIndex(0);
      setIsFlipped(false);
      setShowRating(false);
      setStudyComplete(false);
      setView("study");
    } catch { /* ignore */ }
  };

  const handleRate = async (quality: number) => {
    const card = studyCards[studyIndex];
    await reviewManualCard(deckId, card.id, quality, 0);

    if (studyIndex + 1 >= studyCards.length) {
      setStudyComplete(true);
      await fetchDeck();
      await fetchProgress();
    } else {
      setStudyIndex(studyIndex + 1);
      setIsFlipped(false);
      setShowRating(false);
    }
  };

  const DeckIcon = deck?.icon ? ICON_MAP[deck.icon] || Layers : Layers;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-text-muted">{error || "Deck not found"}</p>
        <button onClick={() => router.push("/")} className="text-primary hover:underline text-sm">
          Go Home
        </button>
      </div>
    );
  }

  // ─── Study View ───
  if (view === "study") {
    if (studyComplete) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="text-5xl mb-4">&#127881;</div>
            <h2 className="text-xl font-[800] text-text-primary mb-2">
              {t("flashcard.deckComplete")}
            </h2>
            <p className="text-text-muted text-sm mb-6">
              {t("flashcard.cardsReviewed", { count: String(studyCards.length) })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setView("list"); setStudyComplete(false); }}
                className="px-5 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-text-primary hover:bg-surface-hover transition-colors"
              >
                {t("common.back")}
              </button>
              <button
                onClick={() => startStudy(reviewingAll)}
                className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-[700] transition-colors"
              >
                {t("flashcard.reviewAgain")}
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    const currentCard = studyCards[studyIndex];

    return (
      <div className="min-h-screen flex flex-col p-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setView("list")} className="text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <span className="text-sm text-text-muted">
            {t("flashcard.cardOf", { current: String(studyIndex + 1), total: String(studyCards.length) })}
          </span>
          <div className="w-5" />
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-border rounded-full mb-6">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((studyIndex + 1) / studyCards.length) * 100}%` }}
          />
        </div>

        {/* Card */}
        <div className="flex-1 flex items-center justify-center" style={{ perspective: 1000 }}>
          <motion.div
            className="w-full max-w-lg cursor-pointer"
            onClick={() => {
              if (!isFlipped) {
                setIsFlipped(true);
                setShowRating(true);
              }
            }}
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.5 }}
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Front */}
            <div
              className="bg-surface border border-border rounded-2xl p-8 min-h-[250px] flex flex-col items-center justify-center text-center"
              style={{ backfaceVisibility: "hidden" }}
            >
              {!isFlipped && (
                <>
                  {currentCard.front_text && (
                    <p className="text-lg font-[700] text-text-primary mb-3">{currentCard.front_text}</p>
                  )}
                  {currentCard.front_image && (
                    <img
                      src={currentCard.front_image}
                      alt="Front"
                      className="max-h-[200px] object-contain rounded-xl cursor-zoom-in"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxSrc(currentCard.front_image!);
                        setLightboxOpen(true);
                      }}
                    />
                  )}
                  <p className="text-xs text-text-muted mt-4">{t("flashcard.tapToFlip")}</p>
                </>
              )}
            </div>

            {/* Back */}
            <div
              className="bg-surface border border-border rounded-2xl p-8 min-h-[250px] flex flex-col items-center justify-center text-center absolute inset-0"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              {isFlipped && (
                <>
                  {currentCard.back_text && (
                    <p className="text-lg text-text-primary mb-3">{currentCard.back_text}</p>
                  )}
                  {currentCard.back_image && (
                    <img
                      src={currentCard.back_image}
                      alt="Back"
                      className="max-h-[200px] object-contain rounded-xl cursor-zoom-in"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxSrc(currentCard.back_image!);
                        setLightboxOpen(true);
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* Rating */}
        <AnimatePresence>
          {showRating && isFlipped && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex justify-center gap-3 mt-6 mb-4"
            >
              {[
                { quality: 1, label: t("flashcard.hard"), color: "bg-red-500/10 text-red-400 border-red-500/20" },
                { quality: 3, label: t("flashcard.good"), color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
                { quality: 5, label: t("flashcard.easy"), color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
              ].map(({ quality, label, color }) => (
                <button
                  key={quality}
                  onClick={() => handleRate(quality)}
                  className={`px-6 py-3 rounded-xl border font-[700] text-sm transition-all hover:scale-105 active:scale-95 ${color}`}
                >
                  {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <ImageLightbox
          src={lightboxSrc}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </div>
    );
  }

  // ─── Progress View ───
  if (view === "progress") {
    return (
      <div className="min-h-screen p-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView("list")} className="text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-[800] text-text-primary">{t("learn.progress")}</h2>
        </div>

        {progress && (
          <div className="space-y-4">
            {/* Mastery Ring */}
            <div className="bg-surface border border-border rounded-2xl p-6 flex items-center gap-6">
              <div className="relative w-20 h-20">
                <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                  <circle cx="18" cy="18" r="15.91" fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
                  <circle
                    cx="18" cy="18" r="15.91" fill="none" stroke="currentColor" strokeWidth="2"
                    className="text-primary"
                    strokeDasharray={`${progress.overall_mastery} ${100 - progress.overall_mastery}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-[800] text-text-primary">
                  {Math.round(progress.overall_mastery)}%
                </span>
              </div>
              <div>
                <p className="text-lg font-[800] text-text-primary">{t("progressDashboard.mastery")}</p>
                <p className="text-sm text-text-muted">{t("progressDashboard.totalCards")}: {progress.total_cards}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t("progressDashboard.mastered"), value: progress.mastered, color: "text-emerald-400" },
                { label: t("progressDashboard.learning"), value: progress.learning, color: "text-amber-400" },
                { label: t("progressDashboard.new"), value: progress.new_cards, color: "text-blue-400" },
                { label: t("progressDashboard.dueNow"), value: progress.due_now, color: "text-red-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-surface border border-border rounded-xl p-4">
                  <p className={`text-2xl font-[800] ${color}`}>{value}</p>
                  <p className="text-xs text-text-muted">{label}</p>
                </div>
              ))}
            </div>

            {progress.due_now > 0 ? (
              <button
                onClick={() => startStudy(false)}
                className="w-full bg-primary hover:bg-primary-hover text-white font-[700] py-3 rounded-xl transition-colors"
              >
                {t("progressDashboard.startReview")} ({progress.due_now})
              </button>
            ) : (
              <div className="text-center py-4">
                <p className="text-text-muted text-sm">{t("manualDeck.allCaughtUp")}</p>
                <button
                  onClick={() => startStudy(true)}
                  className="mt-3 text-primary hover:underline text-sm font-medium"
                >
                  {t("manualDeck.reviewAll")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── List View (default) ───
  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${deck.color}20` }}>
            <DeckIcon size={16} style={{ color: deck.color || "#6366F1" }} />
          </div>
          <div>
            <h1 className="text-xl font-[800] text-text-primary">{deck.title}</h1>
            <p className="text-xs text-text-muted">
              {t("manualDeck.cards", { count: String(deck.cards.length) })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditingCard(null); setShowCardEditor(true); }}
            className="bg-primary hover:bg-primary-hover text-white font-[700] py-2 px-4 rounded-xl transition-colors flex items-center gap-1.5 text-sm"
          >
            <Plus size={16} />
            {t("manualDeck.addCard")}
          </button>
          {deck.cards.length > 0 && (
            <button
              onClick={() => startStudy(true)}
              className="border border-border text-text-primary hover:bg-surface-hover font-medium py-2 px-4 rounded-xl transition-colors flex items-center gap-1.5 text-sm"
            >
              <Play size={14} />
              {t("manualDeck.study")}
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-text-muted hover:text-text-primary transition-colors rounded-xl hover:bg-surface-hover"
            >
              <MoreVertical size={18} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-lg py-1 z-20 min-w-[160px]">
                  <button
                    onClick={() => { setShowMenu(false); setView("progress"); }}
                    className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
                  >
                    {t("learn.progress")}
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-surface-hover transition-colors"
                  >
                    {t("manualDeck.deleteDeck")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between"
          >
            <p className="text-sm text-red-400">{t("manualDeck.deleteConfirm")}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDeck}
                className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                {t("manualDeck.deleteDeck")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card List */}
      {deck.cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Layers size={28} className="text-primary" />
          </div>
          <p className="text-text-muted text-sm">{t("manualDeck.noCards")}</p>
          <button
            onClick={() => { setEditingCard(null); setShowCardEditor(true); }}
            className="bg-primary hover:bg-primary-hover text-white font-[700] py-2.5 px-6 rounded-xl transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            {t("manualDeck.addCard")}
          </button>
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={deck.cards}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {deck.cards.map((card, idx) => (
            <Reorder.Item
              key={card.id}
              value={card}
              className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-3 cursor-grab active:cursor-grabbing"
            >
              <GripVertical size={14} className="text-text-muted shrink-0" />
              <span className="text-xs text-text-muted font-mono w-6 shrink-0">#{idx + 1}</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="flex-1 min-w-0">
                  {card.front_text ? (
                    <p className="text-sm text-text-primary truncate">{card.front_text}</p>
                  ) : card.front_image ? (
                    <span className="text-xs text-text-muted italic">[image]</span>
                  ) : null}
                </div>
                <ArrowRight size={12} className="text-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  {card.back_text ? (
                    <p className="text-sm text-text-muted truncate">{card.back_text}</p>
                  ) : card.back_image ? (
                    <span className="text-xs text-text-muted italic">[image]</span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setEditingCard(card); setShowCardEditor(true); }}
                  className="p-1.5 text-text-muted hover:text-text-primary transition-colors rounded-lg hover:bg-surface-hover"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={async () => {
                    await deleteCard(deckId, card.id);
                    await fetchDeck();
                    await fetchProgress();
                  }}
                  className="p-1.5 text-text-muted hover:text-red-400 transition-colors rounded-lg hover:bg-surface-hover"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      {/* Card Editor Modal */}
      <CardEditorModal
        isOpen={showCardEditor}
        onClose={() => { setShowCardEditor(false); setEditingCard(null); }}
        onSave={handleSaveCard}
        onDelete={editingCard ? handleDeleteCard : undefined}
        card={editingCard}
      />

      <ImageLightbox
        src={lightboxSrc}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
