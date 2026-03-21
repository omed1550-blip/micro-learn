"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Loader2, Check,
  Layers, BookOpen, Brain, Lightbulb,
  GraduationCap, Code, Globe, Music,
} from "lucide-react";
import { createDeck } from "@/lib/api";
import { useLocale } from "@/lib/LocaleContext";

const COLORS = [
  "#6366F1", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#06B6D4", "#F97316",
];

const ICONS = [
  { name: "layers", Icon: Layers },
  { name: "book-open", Icon: BookOpen },
  { name: "brain", Icon: Brain },
  { name: "lightbulb", Icon: Lightbulb },
  { name: "graduation-cap", Icon: GraduationCap },
  { name: "code", Icon: Code },
  { name: "globe", Icon: Globe },
  { name: "music", Icon: Music },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDeckCreated?: () => void;
}

export default function CreateDeckModal({ isOpen, onClose, onDeckCreated }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366F1");
  const [icon, setIcon] = useState("layers");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setColor("#6366F1");
    setIcon("layers");
    setError("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");

    try {
      const deck = await createDeck({
        title: title.trim(),
        description: description.trim() || undefined,
        color,
        icon,
      });
      resetForm();
      onDeckCreated?.();
      onClose();
      router.push(`/decks/${deck.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-surface rounded-2xl border border-border shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-[800] text-text-primary">
                {t("manualDeck.createDeck")}
              </h2>
              <button onClick={handleClose} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              {/* Title */}
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("manualDeck.deckTitle")}
                  required
                  className="w-full bg-background border border-border rounded-xl py-2.5 px-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("manualDeck.deckDescription")}
                  rows={2}
                  className="w-full bg-background border border-border rounded-xl py-2.5 px-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
                />
              </div>

              {/* Color Picker */}
              <div>
                <p className="text-xs font-medium text-text-secondary mb-2">{t("manualDeck.pickColor")}</p>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full transition-all flex items-center justify-center ${
                        color === c ? "ring-2 ring-offset-2 ring-offset-surface" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: c, "--tw-ring-color": c } as React.CSSProperties}
                    >
                      {color === c && <Check size={14} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Picker */}
              <div>
                <p className="text-xs font-medium text-text-secondary mb-2">{t("manualDeck.pickIcon")}</p>
                <div className="flex gap-2">
                  {ICONS.map(({ name, Icon }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setIcon(name)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                        icon === name
                          ? "bg-primary/15 text-primary"
                          : "bg-background text-text-muted hover:text-text-primary hover:bg-surface-hover"
                      }`}
                    >
                      <Icon size={18} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="w-full bg-primary hover:bg-primary-hover text-white font-[700] py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {t("manualDeck.create")}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
