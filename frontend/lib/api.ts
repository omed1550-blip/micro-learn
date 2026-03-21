import axios from "axios";
import { getSession, signOut } from "next-auth/react";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 60000,
});

let isSigningOut = false;

// Attach Bearer token to all requests
api.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    const session = await getSession();
    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const status = error.response.status;
      const detail = error.response.data?.detail || "";

      if (status === 401) {
        // Token expired or invalid — clear session and redirect (once)
        if (typeof window !== "undefined" && !isSigningOut) {
          isSigningOut = true;
          signOut({ callbackUrl: "/auth/signin" });
        }
        throw new Error("Session expired. Please sign in again.");
      } else if (status === 429 || detail.includes("quota") || detail.includes("busy")) {
        throw new Error("AI service is busy. Please wait a minute and try again.");
      } else if (status === 400) {
        throw new Error(detail || "Invalid input. Please check and try again.");
      } else if (status === 404) {
        throw new Error("Not found.");
      } else if (status === 422) {
        throw new Error(detail || "Could not process this content. Try a different source.");
      } else if (status === 502) {
        throw new Error("Content extraction failed. Please try a different source.");
      } else {
        throw new Error(detail || "Something went wrong. Please try again.");
      }
    } else if (error.request) {
      throw new Error("Cannot connect to server. Make sure the backend is running.");
    }
    throw error;
  }
);

// Re-export for convenience
export { getSession } from "next-auth/react";

// ─── Manual Decks ───

export interface ManualDeck {
  id: string;
  title: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  card_count: number;
  created_at: string;
  updated_at: string;
}

export interface ManualCard {
  id: string;
  deck_id: string;
  position: number;
  front_text: string | null;
  front_image: string | null;
  front_image_filename: string | null;
  back_text: string | null;
  back_image: string | null;
  back_image_filename: string | null;
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string;
  lapse_count: number;
  streak: number;
  created_at: string;
  updated_at: string;
}

export async function createDeck(data: { title: string; description?: string; color?: string; icon?: string }): Promise<ManualDeck> {
  const { data: res } = await api.post<ManualDeck>("/api/decks", data);
  return res;
}

export async function getDecks(): Promise<ManualDeck[]> {
  const { data } = await api.get<ManualDeck[]>("/api/decks");
  return data;
}

export async function getDeck(deckId: string): Promise<ManualDeck & { cards: ManualCard[] }> {
  const { data } = await api.get<ManualDeck & { cards: ManualCard[] }>(`/api/decks/${deckId}`);
  return data;
}

export async function updateDeck(deckId: string, data: Partial<Pick<ManualDeck, "title" | "description" | "color" | "icon">>): Promise<ManualDeck> {
  const { data: res } = await api.put<ManualDeck>(`/api/decks/${deckId}`, data);
  return res;
}

export async function deleteDeck(deckId: string): Promise<void> {
  await api.delete(`/api/decks/${deckId}`);
}

export async function createCard(deckId: string, data: {
  front_text?: string;
  front_image?: string | null;
  front_image_filename?: string | null;
  back_text?: string;
  back_image?: string | null;
  back_image_filename?: string | null;
}): Promise<ManualCard> {
  const { data: res } = await api.post<ManualCard>(`/api/decks/${deckId}/cards`, data);
  return res;
}

export async function updateCard(deckId: string, cardId: string, data: Record<string, unknown>): Promise<ManualCard> {
  const { data: res } = await api.put<ManualCard>(`/api/decks/${deckId}/cards/${cardId}`, data);
  return res;
}

export async function deleteCard(deckId: string, cardId: string): Promise<void> {
  await api.delete(`/api/decks/${deckId}/cards/${cardId}`);
}

export async function reorderCards(deckId: string, cardIds: string[]): Promise<ManualCard[]> {
  const { data } = await api.post<ManualCard[]>(`/api/decks/${deckId}/cards/reorder`, { card_ids: cardIds });
  return data;
}

export async function reviewManualCard(deckId: string, cardId: string, quality: number, timeSpent: number): Promise<ManualCard> {
  const { data } = await api.post<ManualCard>(`/api/decks/${deckId}/review`, { card_id: cardId, quality, time_spent_seconds: timeSpent });
  return data;
}

export async function getDeckDueCards(deckId: string): Promise<ManualCard[]> {
  const { data } = await api.get<ManualCard[]>(`/api/decks/${deckId}/due-cards`);
  return data;
}

export async function getDeckProgress(deckId: string): Promise<Progress> {
  const { data } = await api.get<Progress>(`/api/decks/${deckId}/progress`);
  return data;
}

export async function getDeckStudyQueue(deckId: string): Promise<ManualCard[]> {
  const { data } = await api.get<ManualCard[]>(`/api/decks/${deckId}/study-queue`);
  return data;
}

// ─── Activity ───

export interface ActivityResult {
  xp_earned: number;
  total_xp: number;
  level: number;
  level_up: boolean;
  new_level: number | null;
  streak: number;
  multiplier: number;
  new_achievements: { id: string; name: string; description: string; icon: string }[];
  daily_xp: number;
  daily_goal: number;
  daily_goal_met: boolean;
}

export interface DashboardData {
  streak: number;
  longest_streak: number;
  streak_at_risk: boolean;
  level: number;
  total_xp: number;
  xp_in_level: number;
  xp_needed: number;
  daily_xp: number;
  daily_goal: number;
  daily_goal_met: boolean;
  today_cards_reviewed: number;
  today_quizzes: number;
  today_modules: number;
  today_study_seconds: number;
  lifetime: {
    total_cards_reviewed: number;
    total_quizzes_completed: number;
    total_modules_created: number;
    total_study_seconds: number;
    total_perfect_quizzes: number;
  };
  achievements: {
    id: string;
    name: string;
    description: string;
    icon: string;
    condition: string;
    unlocked: boolean;
  }[];
  multiplier: number;
}

export interface CalendarDay {
  date: string;
  xp: number;
  cards: number;
  quizzes: number;
  modules: number;
  seconds: number;
}

export async function getDashboard(): Promise<DashboardData> {
  const { data } = await api.get<DashboardData>("/api/activity/dashboard");
  return data;
}

export async function getActivityCalendar(): Promise<CalendarDay[]> {
  const { data } = await api.get<CalendarDay[]>("/api/activity/calendar");
  return data;
}

export async function updateDailyGoal(goal: number): Promise<{ daily_goal: number }> {
  const { data } = await api.put<{ daily_goal: number }>("/api/activity/goal", { daily_goal: goal });
  return data;
}

export type SourceType = "youtube" | "article" | "notes" | "image" | "pdf" | "document" | "topic";

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  lapse_count: number;
  last_quality: number | null;
  next_review: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  option_feedbacks: string[] | null;
  correct_answer: number;
  explanation: string;
}

export interface LearningModule {
  id: string;
  source_url: string;
  source_type: SourceType;
  title: string;
  summary: string;
  original_filename: string | null;
  created_at: string;
  flashcards: Flashcard[];
  quiz_questions: QuizQuestion[];
}

export interface LearningModuleListItem {
  id: string;
  source_url: string;
  source_type: SourceType;
  title: string;
  summary: string;
  original_filename: string | null;
  created_at: string;
}

export interface ReviewResponse {
  flashcard_id: string;
  new_easiness_factor: number;
  new_interval_days: number;
  new_lapse_count: number;
  next_review: string;
}

export interface Recommendation {
  action: "review_flashcards" | "take_quiz" | "all_mastered";
  reason: string;
  estimated_minutes: number;
  cards_due: number;
}

export interface Progress {
  total_cards: number;
  mastered: number;
  learning: number;
  new_cards: number;
  due_now: number;
  total_quiz_questions: number;
  quiz_attempts: number;
  best_quiz_score: number;
  overall_mastery: number;
}

export interface QuizAttempt {
  id: string;
  score: number;
  total: number;
  percentage: number;
  completed_at: string;
}

export interface GenerateOptions {
  generateFlashcards?: boolean;
  generateQuiz?: boolean;
}

export async function generateModule(url: string, options?: GenerateOptions): Promise<LearningModule> {
  const { data } = await api.post<LearningModule>("/api/generate", {
    url,
    generate_flashcards: options?.generateFlashcards ?? true,
    generate_quiz: options?.generateQuiz ?? true,
  });
  return data;
}

export async function generateFromNotes(title: string, content: string, options?: GenerateOptions): Promise<LearningModule> {
  const { data } = await api.post<LearningModule>("/api/generate/notes", {
    title,
    content,
    generate_flashcards: options?.generateFlashcards ?? true,
    generate_quiz: options?.generateQuiz ?? true,
  });
  return data;
}

export async function generateFromFile(file: File, options?: GenerateOptions): Promise<LearningModule> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("generate_flashcards", String(options?.generateFlashcards ?? true));
  formData.append("generate_quiz", String(options?.generateQuiz ?? true));
  const { data } = await api.post<LearningModule>("/api/generate/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000,
  });
  return data;
}

export type Difficulty = "beginner" | "intermediate" | "advanced";

export async function generateFromTopic(
  topic: string,
  difficulty: Difficulty = "beginner",
  options?: GenerateOptions
): Promise<LearningModule> {
  const { data } = await api.post<LearningModule>("/api/generate/topic", {
    topic,
    difficulty,
    generate_flashcards: options?.generateFlashcards ?? true,
    generate_quiz: options?.generateQuiz ?? true,
  });
  return data;
}

export async function explainAgain(
  moduleId: string,
  mode: "simplify" | "analogy" | "real_world"
): Promise<{ explanation: string }> {
  const { data } = await api.post<{ explanation: string }>(
    `/api/modules/${moduleId}/explain-again`,
    { mode }
  );
  return data;
}

export async function getModule(moduleId: string): Promise<LearningModule> {
  const { data } = await api.get<LearningModule>(`/api/modules/${moduleId}`);
  return data;
}

export async function getModules(): Promise<LearningModuleListItem[]> {
  const { data } = await api.get<LearningModuleListItem[]>("/api/modules");
  return data;
}

export async function reviewCard(
  flashcardId: string,
  quality: number,
  timeSpentSeconds: number = 0
): Promise<ReviewResponse> {
  const { data } = await api.post<ReviewResponse>("/api/review", {
    flashcard_id: flashcardId,
    quality,
    time_spent_seconds: timeSpentSeconds,
  });
  return data;
}

export async function getDueCards(moduleId: string): Promise<Flashcard[]> {
  const { data } = await api.get<Flashcard[]>(
    `/api/modules/${moduleId}/due-cards`
  );
  return data;
}

export async function getProgress(moduleId: string): Promise<Progress> {
  const { data } = await api.get<Progress>(
    `/api/modules/${moduleId}/progress`
  );
  return data;
}

export async function submitQuiz(
  moduleId: string,
  score: number,
  total: number
): Promise<QuizAttempt> {
  const { data } = await api.post<QuizAttempt>(
    `/api/modules/${moduleId}/submit-quiz`,
    { score, total }
  );
  return data;
}

export async function getQuizHistory(moduleId: string): Promise<QuizAttempt[]> {
  const { data } = await api.get<QuizAttempt[]>(
    `/api/modules/${moduleId}/quiz-history`
  );
  return data;
}

export async function getStudyQueue(moduleId: string): Promise<Flashcard[]> {
  const { data } = await api.get<Flashcard[]>(
    `/api/modules/${moduleId}/study-queue`
  );
  return data;
}

export async function getRecommendation(moduleId: string): Promise<Recommendation> {
  const { data } = await api.get<Recommendation>(
    `/api/modules/${moduleId}/recommendation`
  );
  return data;
}

// ─── Study Sessions ───

export interface StudySession {
  id: string;
  module_id: string;
  session_type: "flashcards" | "quiz";
  current_card_index: number;
  cards_reviewed: number;
  card_order: string[] | null;
  card_results: Record<string, unknown>[] | null;
  current_question_index: number;
  questions_answered: number;
  quiz_answers: Record<string, unknown>[] | null;
  is_completed: boolean;
  started_at: string;
  updated_at: string;
  total_time_seconds: number;
}

export async function startSession(moduleId: string, sessionType: "flashcards" | "quiz"): Promise<StudySession> {
  const { data } = await api.post<StudySession>(`/api/modules/${moduleId}/session/start`, { session_type: sessionType });
  return data;
}

export async function updateSession(moduleId: string, sessionId: string, updates: Partial<Pick<StudySession, "current_card_index" | "cards_reviewed" | "card_results" | "current_question_index" | "questions_answered" | "quiz_answers" | "total_time_seconds">>): Promise<StudySession> {
  const { data } = await api.put<StudySession>(`/api/modules/${moduleId}/session/${sessionId}`, updates);
  return data;
}

export async function completeSession(moduleId: string, sessionId: string): Promise<StudySession> {
  const { data } = await api.post<StudySession>(`/api/modules/${moduleId}/session/${sessionId}/complete`);
  return data;
}

export async function getActiveSession(moduleId: string): Promise<StudySession | null> {
  try {
    const { data } = await api.get<StudySession>(`/api/modules/${moduleId}/session/active`);
    return data;
  } catch {
    return null;
  }
}
