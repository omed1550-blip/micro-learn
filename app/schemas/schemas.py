import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


# --- Request Models ---

class GenerateRequest(BaseModel):
    url: str = Field(min_length=1)
    generate_flashcards: bool = True
    generate_quiz: bool = True


class NotesRequest(BaseModel):
    title: str = Field(min_length=1)
    content: str = Field(min_length=10)
    generate_flashcards: bool = True
    generate_quiz: bool = True


class TopicRequest(BaseModel):
    topic: str = Field(min_length=1)
    difficulty: Literal["beginner", "intermediate", "advanced"] = "beginner"
    generate_flashcards: bool = True
    generate_quiz: bool = True


class ExplainAgainRequest(BaseModel):
    mode: Literal["simplify", "analogy", "real_world"]


class ReviewRequest(BaseModel):
    flashcard_id: uuid.UUID
    quality: int = Field(ge=0, le=5)
    time_spent_seconds: float = 0


class QuizSubmitRequest(BaseModel):
    score: int = Field(ge=0)
    total: int = Field(ge=1)


# --- Response Models ---

class FlashcardSchema(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    front: str
    back: str
    easiness_factor: float
    interval_days: int
    repetitions: int
    lapse_count: int = 0
    last_quality: int | None = None
    next_review: datetime


class QuizQuestionSchema(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    question: str
    options: list[str]
    option_feedbacks: list[str] | None = None
    correct_answer: int
    explanation: str


class LearningModuleSchema(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    source_url: str
    source_type: str
    title: str
    summary: str
    original_filename: str | None = None
    created_at: datetime
    flashcards: list[FlashcardSchema]
    quiz_questions: list[QuizQuestionSchema]


class ReviewResponse(BaseModel):
    flashcard_id: uuid.UUID
    new_easiness_factor: float
    new_interval_days: int
    new_lapse_count: int = 0
    next_review: datetime


class QuizAttemptSchema(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    score: int
    total: int
    percentage: float
    completed_at: datetime


class RecommendationSchema(BaseModel):
    action: str
    reason: str
    estimated_minutes: int = 0
    cards_due: int = 0


class ProgressSchema(BaseModel):
    total_cards: int
    mastered: int
    learning: int
    new_cards: int = 0
    due_now: int
    total_quiz_questions: int = 0
    quiz_attempts: int = 0
    best_quiz_score: float = 0.0
    overall_mastery: float = 0.0


# --- AI Validation Models ---

class FlashcardAI(BaseModel):
    front: str = Field(min_length=1)
    back: str = Field(min_length=1)


class QuizQuestionAI(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    option_feedbacks: list[str] = Field(min_length=4, max_length=4)
    correct_answer: int = Field(ge=0, le=3)
    explanation: str


class GeminiOutput(BaseModel):
    summary: str = Field(max_length=3000)
    flashcards: list[FlashcardAI] = Field(default_factory=list)
    quiz: list[QuizQuestionAI] = Field(default_factory=list)


class ExplainAgainResponse(BaseModel):
    explanation: str


# --- Session Models ---

class StartSessionRequest(BaseModel):
    session_type: Literal["flashcards", "quiz"]


class UpdateSessionRequest(BaseModel):
    current_card_index: int | None = None
    cards_reviewed: int | None = None
    card_results: list | None = None
    current_question_index: int | None = None
    questions_answered: int | None = None
    quiz_answers: list | None = None
    total_time_seconds: float | None = None


class StudySessionSchema(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    module_id: uuid.UUID
    session_type: str
    current_card_index: int
    cards_reviewed: int
    card_order: list | None = None
    card_results: list | None = None
    current_question_index: int
    questions_answered: int
    quiz_answers: list | None = None
    is_completed: bool
    started_at: datetime
    updated_at: datetime
    total_time_seconds: float


# --- Manual Deck Models ---

class CreateDeckRequest(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""
    color: str = "#6366F1"
    icon: str = "layers"


class UpdateDeckRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    color: str | None = None
    icon: str | None = None


class CreateCardRequest(BaseModel):
    front_text: str = ""
    front_image: str | None = None
    front_image_filename: str | None = None
    back_text: str = ""
    back_image: str | None = None
    back_image_filename: str | None = None


class UpdateCardRequest(BaseModel):
    front_text: str | None = None
    front_image: str | None = None
    front_image_filename: str | None = None
    back_text: str | None = None
    back_image: str | None = None
    back_image_filename: str | None = None
    position: int | None = None


class ReorderCardsRequest(BaseModel):
    card_ids: list[uuid.UUID]


class ManualCardReviewRequest(BaseModel):
    card_id: uuid.UUID
    quality: int = Field(ge=0, le=5)
    time_spent_seconds: float = 0


class ManualCardSchema(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    deck_id: uuid.UUID
    position: int
    front_text: str | None = None
    front_image: str | None = None
    front_image_filename: str | None = None
    back_text: str | None = None
    back_image: str | None = None
    back_image_filename: str | None = None
    easiness_factor: float
    interval_days: int
    repetitions: int
    next_review: datetime
    lapse_count: int
    streak: int
    created_at: datetime
    updated_at: datetime


class ManualDeckSchema(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    title: str
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    card_count: int
    created_at: datetime
    updated_at: datetime


class ManualDeckDetailSchema(ManualDeckSchema):
    cards: list[ManualCardSchema] = []


class LearningModuleListSchema(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    source_url: str
    source_type: str
    title: str
    summary: str
    original_filename: str | None = None
    created_at: datetime


