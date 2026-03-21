"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu } from "lucide-react";
import { useSidebar } from "@/lib/SidebarContext";
import { useLocale } from "@/lib/LocaleContext";
import Sidebar from "./Sidebar";
import NewModuleModal from "./NewModuleModal";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { isOpen, open } = useSidebar();
  const { direction } = useLocale();
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const isRTL = direction === "rtl";

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const handler = () => setModalOpen(true);
    window.addEventListener("open-new-module-modal", handler);
    return () => window.removeEventListener("open-new-module-modal", handler);
  }, []);

  const handleModuleCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const marginValue = isOpen && isDesktop ? 280 : 0;

  return (
    <>
      <Sidebar onNewModule={() => setModalOpen(true)} refreshKey={refreshKey} />

      {/* Toggle button when sidebar is closed */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={open}
            className={`fixed top-4 ${isRTL ? "right-4" : "left-4"} z-30 glass rounded-lg w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors`}
          >
            <Menu size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div
        className="transition-all duration-300 ease-in-out min-h-screen"
        style={{ [isRTL ? "marginRight" : "marginLeft"]: marginValue }}
      >
        {children}
      </div>

      <NewModuleModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onModuleCreated={handleModuleCreated}
      />
    </>
  );
}
