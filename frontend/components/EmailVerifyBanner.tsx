"use client";

import { useSession } from "next-auth/react";
import { AlertTriangle } from "lucide-react";

export default function EmailVerifyBanner() {
  const { data: session } = useSession();

  if (!session || session.emailVerified !== false) return null;

  return (
    <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 text-center text-xs text-warning flex items-center justify-center gap-2">
      <AlertTriangle size={14} />
      Please verify your email address
    </div>
  );
}
