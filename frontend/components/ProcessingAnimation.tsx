"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Layers, CheckCircle } from "lucide-react";
import { useLocale } from "@/lib/LocaleContext";

interface Props {
  isActive: boolean;
  onComplete: () => void;
}

interface NodePos {
  x: number;
  y: number;
}

export default function ProcessingAnimation({ isActive, onComplete }: Props) {
  const { t } = useLocale();
  const [stage, setStage] = useState(0);
  const conceptCount = useMemo(() => Math.floor(Math.random() * 7) + 8, []);

  const nodes: NodePos[] = useMemo(
    () =>
      Array.from({ length: 6 }, () => ({
        x: Math.random() * 200 + 30,
        y: Math.random() * 140 + 20,
      })),
    []
  );

  const lines = useMemo(() => {
    const l: [number, number][] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      l.push([i, i + 1]);
      if (i + 2 < nodes.length && Math.random() > 0.5) l.push([i, i + 2]);
    }
    return l;
  }, [nodes]);

  useEffect(() => {
    if (!isActive) {
      setStage(0);
      return;
    }
    setStage(1);
    const t2 = setTimeout(() => setStage(2), 2500);
    const t3 = setTimeout(() => setStage(3), 5500);
    const t4 = setTimeout(() => setStage(4), 8000);
    const tDone = setTimeout(() => onComplete(), 9000);
    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(tDone);
    };
  }, [isActive, onComplete]);

  if (!isActive) return null;

  const progress =
    stage === 1 ? 30 : stage === 2 ? 60 : stage === 3 ? 90 : 100;
  const barColor = stage === 4 ? "bg-success" : "bg-primary";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex items-center justify-center"
    >
      <div className="max-w-lg w-full px-6 text-center">
        <AnimatePresence mode="wait">
          {stage === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center"
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <FileText size={48} className="text-primary mb-6" />
              </motion.div>
              <h2 className="text-xl mb-2">{t("processing.stage1Title")}</h2>
              <p className="text-text-secondary text-sm">
                {t("processing.stage1Sub")}
              </p>
            </motion.div>
          )}

          {stage === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center"
            >
              <div className="relative w-64 h-48 mb-6">
                {nodes.map((node, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      y: [0, -5, 0],
                    }}
                    transition={{
                      delay: i * 0.3,
                      y: {
                        repeat: Infinity,
                        duration: 2 + Math.random(),
                        delay: i * 0.2,
                      },
                    }}
                    className="absolute w-3 h-3 rounded-full bg-primary"
                    style={{ left: node.x, top: node.y }}
                  />
                ))}
              </div>
              <h2 className="text-xl mb-2">{t("processing.stage2Title")}</h2>
              <p className="text-text-secondary text-sm">
                {t("processing.stage2Sub", { count: conceptCount })}
              </p>
            </motion.div>
          )}

          {stage === 3 && (
            <motion.div
              key="s3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center"
            >
              <div className="relative w-64 h-48 mb-6">
                <svg className="absolute inset-0 w-full h-full">
                  {lines.map(([a, b], i) => (
                    <motion.line
                      key={i}
                      x1={nodes[a].x + 6}
                      y1={nodes[a].y + 6}
                      x2={nodes[b].x + 6}
                      y2={nodes[b].y + 6}
                      stroke="rgba(99,102,241,0.3)"
                      strokeWidth={2}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.8, delay: i * 0.15 }}
                    />
                  ))}
                </svg>
                {nodes.map((node, i) => (
                  <motion.div
                    key={`n${i}`}
                    animate={{ y: [0, -5, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 2 + Math.random(),
                    }}
                    className="absolute w-3 h-3 rounded-full bg-primary"
                    style={{ left: node.x, top: node.y }}
                  />
                ))}
                {[0, 2, 4].map((idx) => (
                  <motion.div
                    key={`card${idx}`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + idx * 0.2 }}
                    className="absolute"
                    style={{
                      left: nodes[idx].x - 4,
                      top: nodes[idx].y - 14,
                    }}
                  >
                    <Layers size={14} className="text-primary-hover" />
                  </motion.div>
                ))}
              </div>
              <h2 className="text-xl mb-2">{t("processing.stage3Title")}</h2>
              <p className="text-text-secondary text-sm">
                {t("processing.stage3Sub")}
              </p>
            </motion.div>
          )}

          {stage === 4 && (
            <motion.div
              key="s4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center"
            >
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(16,185,129,0.3)",
                    "0 0 40px rgba(16,185,129,0.5)",
                    "0 0 20px rgba(16,185,129,0.3)",
                  ],
                }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="rounded-full p-4 mb-6"
              >
                <CheckCircle size={48} className="text-success" />
              </motion.div>
              <h2 className="text-xl mb-2">{t("processing.stage4Title")}</h2>
              <p className="text-text-secondary text-sm">
                {t("processing.stage4Sub")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <div className="mt-10 w-full h-2 bg-surface rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${barColor}`}
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>
    </motion.div>
  );
}
