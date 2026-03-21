"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { usePathname } from "next/navigation";

interface SidebarContextValue {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

function getIsMobile() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem("micro-learn-sidebar");
    if (stored !== null) {
      setIsOpen(stored === "true" && !getIsMobile());
    } else {
      setIsOpen(!getIsMobile());
    }
  }, []);

  // Auto-close on mobile navigation
  useEffect(() => {
    if (getIsMobile()) {
      setIsOpen(false);
    }
  }, [pathname]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem("micro-learn-sidebar", String(next));
      return next;
    });
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    localStorage.setItem("micro-learn-sidebar", "true");
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem("micro-learn-sidebar", "false");
  }, []);

  return (
    <SidebarContext.Provider value={{ isOpen, toggle, open, close }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
