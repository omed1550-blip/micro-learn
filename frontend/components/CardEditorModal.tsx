"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Image as ImageIcon, RotateCw, Trash2, Loader2 } from "lucide-react";
import { ManualCard } from "@/lib/api";
import { useLocale } from "@/lib/LocaleContext";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    front_text: string;
    front_image: string | null;
    front_image_filename: string | null;
    back_text: string;
    back_image: string | null;
    back_image_filename: string | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  card?: ManualCard | null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface SideEditorProps {
  label: string;
  text: string;
  setText: (v: string) => void;
  image: string | null;
  setImage: (v: string | null) => void;
  imageFilename: string | null;
  setImageFilename: (v: string | null) => void;
  placeholder: string;
  error: string;
  setError: (v: string) => void;
  t: (key: string) => string;
}

function SideEditor({
  label, text, setText, image, setImage,
  imageFilename, setImageFilename, placeholder, error, setError, t,
}: SideEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Unsupported image format");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError(t("manualDeck.imageTooLarge"));
      return;
    }
    setError("");
    const base64 = await fileToBase64(file);
    setImage(base64);
    setImageFilename(file.name);
  }, [setImage, setImageFilename, setError, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider">{label}</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-background border border-border rounded-xl py-3 px-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
        style={{ minHeight: 120 }}
      />

      {/* Image */}
      <div className="mt-2">
        {image ? (
          <div className="relative">
            <img
              src={image}
              alt={imageFilename || "Card image"}
              className="w-full max-h-[200px] object-contain rounded-xl border border-border bg-background"
            />
            <button
              type="button"
              onClick={() => { setImage(null); setImageFilename(null); }}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
            >
              <X size={14} />
            </button>
            {imageFilename && (
              <p className="text-[10px] text-text-muted mt-1 truncate">{imageFilename}</p>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-[10px] text-primary hover:underline mt-0.5"
            >
              {t("manualDeck.replaceImage")}
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl py-4 flex flex-col items-center gap-1 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <ImageIcon size={18} className="text-text-muted" />
            <span className="text-xs text-text-muted">{t("manualDeck.addImage")}</span>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

export default function CardEditorModal({ isOpen, onClose, onSave, onDelete, card }: Props) {
  const { t } = useLocale();
  const [frontText, setFrontText] = useState("");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [frontImageFilename, setFrontImageFilename] = useState<string | null>(null);
  const [backText, setBackText] = useState("");
  const [backImage, setBackImage] = useState<string | null>(null);
  const [backImageFilename, setBackImageFilename] = useState<string | null>(null);
  const [frontError, setFrontError] = useState("");
  const [backError, setBackError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Preview flip state
  const [previewFlipped, setPreviewFlipped] = useState(false);

  useEffect(() => {
    if (card) {
      setFrontText(card.front_text || "");
      setFrontImage(card.front_image || null);
      setFrontImageFilename(card.front_image_filename || null);
      setBackText(card.back_text || "");
      setBackImage(card.back_image || null);
      setBackImageFilename(card.back_image_filename || null);
    } else {
      setFrontText("");
      setFrontImage(null);
      setFrontImageFilename(null);
      setBackText("");
      setBackImage(null);
      setBackImageFilename(null);
    }
    setFrontError("");
    setBackError("");
    setPreviewFlipped(false);
    setShowDeleteConfirm(false);
  }, [card, isOpen]);

  const hasFront = frontText.trim() || frontImage;
  const hasBack = backText.trim() || backImage;
  const canSave = hasFront && hasBack;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        front_text: frontText.trim(),
        front_image: frontImage,
        front_image_filename: frontImageFilename,
        back_text: backText.trim(),
        back_image: backImage,
        back_image_filename: backImageFilename,
      });
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setDeleting(false);
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl max-h-[90vh] bg-surface rounded-2xl border border-border shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <h2 className="text-lg font-[800] text-text-primary">
                {card ? t("manualDeck.editCard") : t("manualDeck.addCard")}
              </h2>
              <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <SideEditor
                  label={t("manualDeck.front")}
                  text={frontText}
                  setText={setFrontText}
                  image={frontImage}
                  setImage={setFrontImage}
                  imageFilename={frontImageFilename}
                  setImageFilename={setFrontImageFilename}
                  placeholder={t("manualDeck.questionPlaceholder")}
                  error={frontError}
                  setError={setFrontError}
                  t={t}
                />

                <div className="flex items-center justify-center md:pt-8">
                  <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center">
                    <RotateCw size={14} className="text-text-muted" />
                  </div>
                </div>

                <SideEditor
                  label={t("manualDeck.back")}
                  text={backText}
                  setText={setBackText}
                  image={backImage}
                  setImage={setBackImage}
                  imageFilename={backImageFilename}
                  setImageFilename={setBackImageFilename}
                  placeholder={t("manualDeck.answerPlaceholder")}
                  error={backError}
                  setError={setBackError}
                  t={t}
                />
              </div>

              {/* Preview */}
              {(hasFront || hasBack) && (
                <div>
                  <p className="text-xs font-medium text-text-secondary mb-2">Preview</p>
                  <div
                    className="bg-background border border-border rounded-xl p-4 cursor-pointer min-h-[80px] flex flex-col items-center justify-center text-center"
                    onClick={() => setPreviewFlipped(!previewFlipped)}
                  >
                    {!previewFlipped ? (
                      <>
                        {frontText && <p className="text-sm font-semibold text-text-primary">{frontText}</p>}
                        {frontImage && (
                          <img src={frontImage} alt="Front" className="max-h-[100px] object-contain mt-2 rounded-lg" />
                        )}
                        {!hasFront && <p className="text-text-muted text-xs">({t("manualDeck.front")})</p>}
                      </>
                    ) : (
                      <>
                        {backText && <p className="text-sm text-text-primary">{backText}</p>}
                        {backImage && (
                          <img src={backImage} alt="Back" className="max-h-[100px] object-contain mt-2 rounded-lg" />
                        )}
                        {!hasBack && <p className="text-text-muted text-xs">({t("manualDeck.back")})</p>}
                      </>
                    )}
                    <p className="text-[10px] text-text-muted mt-2">
                      {previewFlipped ? t("manualDeck.back") : t("manualDeck.front")} - tap to flip
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-5 border-t border-border shrink-0">
              <div>
                {card && onDelete && (
                  showDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">{t("manualDeck.deleteCardConfirm")}</span>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="text-xs text-red-400 hover:text-red-300 font-medium"
                      >
                        {deleting ? <Loader2 size={12} className="animate-spin" /> : t("manualDeck.deleteCard")}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="text-xs text-text-muted hover:text-text-primary"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      <Trash2 size={14} />
                      {t("manualDeck.deleteCard")}
                    </button>
                  )
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave || saving}
                  className="bg-primary hover:bg-primary-hover text-white font-[700] py-2 px-5 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {t("manualDeck.saveCard")}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
