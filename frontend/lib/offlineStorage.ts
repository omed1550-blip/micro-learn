import type { LearningModule, StudySession } from "./api";

const DB_NAME = "microlearn_offline";
const DB_VERSION = 1;

class OfflineStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("modules")) {
          const store = db.createObjectStore("modules", { keyPath: "id" });
          store.createIndex("updated_at", "cached_at");
        }
        if (!db.objectStoreNames.contains("pending_reviews")) {
          db.createObjectStore("pending_reviews", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("pending_quiz_submissions")) {
          db.createObjectStore("pending_quiz_submissions", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("sessions")) {
          db.createObjectStore("sessions", { keyPath: "key" });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private getStore(name: string, mode: IDBTransactionMode = "readonly"): IDBObjectStore {
    if (!this.db) throw new Error("DB not initialized");
    return this.db.transaction(name, mode).objectStore(name);
  }

  private request<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ─── Modules ───

  async saveModule(module: LearningModule): Promise<void> {
    if (!this.db) return;
    const store = this.getStore("modules", "readwrite");
    await this.request(store.put({ ...module, cached_at: new Date().toISOString() }));
  }

  async getModule(moduleId: string): Promise<LearningModule | null> {
    if (!this.db) return null;
    const store = this.getStore("modules");
    const result = await this.request(store.get(moduleId));
    return result ?? null;
  }

  async getAllModules(): Promise<LearningModule[]> {
    if (!this.db) return [];
    const store = this.getStore("modules");
    return this.request(store.getAll());
  }

  // ─── Pending Reviews ───

  async savePendingReview(review: {
    flashcard_id: string;
    quality: number;
    time_spent_seconds: number;
    reviewed_at: string;
  }): Promise<void> {
    if (!this.db) return;
    const store = this.getStore("pending_reviews", "readwrite");
    await this.request(store.add(review));
  }

  async getPendingReviews(): Promise<Record<string, unknown>[]> {
    if (!this.db) return [];
    const store = this.getStore("pending_reviews");
    return this.request(store.getAll());
  }

  async clearPendingReviews(): Promise<void> {
    if (!this.db) return;
    const store = this.getStore("pending_reviews", "readwrite");
    await this.request(store.clear());
  }

  // ─── Pending Quiz Submissions ───

  async savePendingQuizSubmission(submission: {
    module_id: string;
    score: number;
    total: number;
    completed_at: string;
  }): Promise<void> {
    if (!this.db) return;
    const store = this.getStore("pending_quiz_submissions", "readwrite");
    await this.request(store.add(submission));
  }

  async getPendingQuizSubmissions(): Promise<Record<string, unknown>[]> {
    if (!this.db) return [];
    const store = this.getStore("pending_quiz_submissions");
    return this.request(store.getAll());
  }

  async clearPendingQuizSubmissions(): Promise<void> {
    if (!this.db) return;
    const store = this.getStore("pending_quiz_submissions", "readwrite");
    await this.request(store.clear());
  }

  // ─── Session State ───

  async saveSessionState(session: StudySession): Promise<void> {
    if (!this.db) return;
    const store = this.getStore("sessions", "readwrite");
    await this.request(store.put({ ...session, key: `${session.module_id}_${session.session_type}` }));
  }

  async getSessionState(moduleId: string, sessionType: string): Promise<StudySession | null> {
    if (!this.db) return null;
    const store = this.getStore("sessions");
    const result = await this.request(store.get(`${moduleId}_${sessionType}`));
    return result ?? null;
  }

  // ─── Pending counts ───

  async getPendingCount(): Promise<number> {
    const reviews = await this.getPendingReviews();
    const quizzes = await this.getPendingQuizSubmissions();
    return reviews.length + quizzes.length;
  }
}

export const offlineStorage = new OfflineStorage();
