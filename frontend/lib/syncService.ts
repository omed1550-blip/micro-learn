import { offlineStorage } from "./offlineStorage";
import { reviewCard, submitQuiz } from "./api";

type SyncListener = (result: { reviews: number; quizzes: number }) => void;

class SyncService {
  private _isOnline = true;
  private syncInProgress = false;
  private listeners: Set<SyncListener> = new Set();

  init() {
    if (typeof window === "undefined") return;
    this._isOnline = navigator.onLine;
    window.addEventListener("online", () => {
      this._isOnline = true;
      this.syncAll();
    });
    window.addEventListener("offline", () => {
      this._isOnline = false;
    });
  }

  get isOnline() {
    return this._isOnline;
  }

  onSync(listener: SyncListener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  async syncAll(): Promise<{ reviews: number; quizzes: number }> {
    if (this.syncInProgress || !this._isOnline) return { reviews: 0, quizzes: 0 };
    this.syncInProgress = true;

    let reviewsSynced = 0;
    let quizzesSynced = 0;

    try {
      // Sync pending reviews
      const pendingReviews = await offlineStorage.getPendingReviews();
      for (const review of pendingReviews) {
        try {
          await reviewCard(
            review.flashcard_id as string,
            review.quality as number,
            review.time_spent_seconds as number,
          );
          reviewsSynced++;
        } catch {
          // Keep for next sync attempt
        }
      }
      if (reviewsSynced > 0) await offlineStorage.clearPendingReviews();

      // Sync pending quiz submissions
      const pendingQuizzes = await offlineStorage.getPendingQuizSubmissions();
      for (const quiz of pendingQuizzes) {
        try {
          await submitQuiz(
            quiz.module_id as string,
            quiz.score as number,
            quiz.total as number,
          );
          quizzesSynced++;
        } catch {
          // Keep for next sync attempt
        }
      }
      if (quizzesSynced > 0) await offlineStorage.clearPendingQuizSubmissions();
    } finally {
      this.syncInProgress = false;
    }

    const result = { reviews: reviewsSynced, quizzes: quizzesSynced };
    if (reviewsSynced > 0 || quizzesSynced > 0) {
      this.listeners.forEach((fn) => fn(result));
    }
    return result;
  }
}

export const syncService = new SyncService();
