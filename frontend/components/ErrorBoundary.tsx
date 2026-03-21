"use client";

import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <AlertCircle size={48} className="text-error mx-auto mb-4" />
            <h1 className="text-2xl font-[800] text-text-primary mb-2">
              Oops! Something went wrong
            </h1>
            <p className="text-text-secondary text-sm mb-6">
              Try refreshing the page
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-xl transition-colors active:scale-95 transition-transform duration-100 inline-flex items-center gap-2"
            >
              <RotateCcw size={18} />
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
