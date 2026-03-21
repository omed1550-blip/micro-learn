import uuid

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func, TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database import Base


class PortableUUID(TypeDecorator):
    """UUID type that works across PostgreSQL (native) and SQLite (CHAR(32))."""
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(32))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(value)
        return value.hex if isinstance(value, uuid.UUID) else uuid.UUID(value).hex

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    image: Mapped[str | None] = mapped_column(String, nullable=True)
    hashed_password: Mapped[str | None] = mapped_column(String, nullable=True)
    auth_provider: Mapped[str | None] = mapped_column(String, nullable=True)
    provider_account_id: Mapped[str | None] = mapped_column(String, nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login = mapped_column(DateTime(timezone=True), nullable=True)

    modules: Mapped[list["LearningModule"]] = relationship(back_populates="user")


class LearningModule(Base):
    __tablename__ = "learning_modules"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(PortableUUID(), ForeignKey("users.id"), nullable=True)
    source_url: Mapped[str] = mapped_column(String, nullable=False)
    source_type: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    raw_transcript: Mapped[str] = mapped_column(Text, nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String, nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="modules")
    flashcards: Mapped[list["Flashcard"]] = relationship(back_populates="module")
    quiz_questions: Mapped[list["QuizQuestion"]] = relationship(back_populates="module")
    quiz_attempts: Mapped[list["QuizAttempt"]] = relationship(back_populates="module")


class Flashcard(Base):
    __tablename__ = "flashcards"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    module_id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), ForeignKey("learning_modules.id", ondelete="CASCADE"), nullable=False)
    front: Mapped[str] = mapped_column(Text, nullable=False)
    back: Mapped[str] = mapped_column(Text, nullable=False)
    easiness_factor: Mapped[float] = mapped_column(Float, default=2.5)
    interval_days: Mapped[int] = mapped_column(Integer, default=0)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    lapse_count: Mapped[int] = mapped_column(Integer, default=0)
    last_quality: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    next_review = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())

    module: Mapped["LearningModule"] = relationship(back_populates="flashcards")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    module_id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), ForeignKey("learning_modules.id", ondelete="CASCADE"), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    options = mapped_column(JSON, nullable=False)
    option_feedbacks = mapped_column(JSON, nullable=True)
    correct_answer: Mapped[int] = mapped_column(Integer, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)

    module: Mapped["LearningModule"] = relationship(back_populates="quiz_questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    module_id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), ForeignKey("learning_modules.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(PortableUUID(), ForeignKey("users.id"), nullable=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    total: Mapped[int] = mapped_column(Integer, nullable=False)
    percentage: Mapped[float] = mapped_column(Float, nullable=False)
    completed_at = mapped_column(DateTime(timezone=True), server_default=func.now())

    module: Mapped["LearningModule"] = relationship(back_populates="quiz_attempts")


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    flashcard_id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), ForeignKey("flashcards.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(PortableUUID(), ForeignKey("users.id"), nullable=True)
    quality: Mapped[int] = mapped_column(Integer, nullable=False)
    reviewed_at = mapped_column(DateTime(timezone=True), server_default=func.now())


class ManualDeck(Base):
    __tablename__ = "manual_decks"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(String, nullable=True, default="#6366F1")
    icon: Mapped[str | None] = mapped_column(String, nullable=True, default="layers")
    card_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship()
    cards: Mapped[list["ManualCard"]] = relationship(back_populates="deck", cascade="all, delete-orphan", order_by="ManualCard.position")


class ManualCard(Base):
    __tablename__ = "manual_cards"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    deck_id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), ForeignKey("manual_decks.id", ondelete="CASCADE"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    front_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    front_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    front_image_filename: Mapped[str | None] = mapped_column(String, nullable=True)

    back_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    back_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    back_image_filename: Mapped[str | None] = mapped_column(String, nullable=True)

    easiness_factor: Mapped[float] = mapped_column(Float, default=2.5)
    interval_days: Mapped[int] = mapped_column(Integer, default=0)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    next_review = mapped_column(DateTime(timezone=True), server_default=func.now())
    lapse_count: Mapped[int] = mapped_column(Integer, default=0)
    last_quality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    streak: Mapped[int] = mapped_column(Integer, default=0)

    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    deck: Mapped["ManualDeck"] = relationship(back_populates="cards")


class DailyActivity(Base):
    __tablename__ = "daily_activities"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_user_date"),)

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = mapped_column(Date, nullable=False, index=True)

    cards_reviewed: Mapped[int] = mapped_column(Integer, default=0)
    quizzes_completed: Mapped[int] = mapped_column(Integer, default=0)
    modules_created: Mapped[int] = mapped_column(Integer, default=0)
    cards_created: Mapped[int] = mapped_column(Integer, default=0)
    xp_earned: Mapped[int] = mapped_column(Integer, default=0)
    study_seconds: Mapped[int] = mapped_column(Integer, default=0)

    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserStats(Base):
    __tablename__ = "user_stats"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    total_xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    daily_goal: Mapped[int] = mapped_column(Integer, default=50)  # XP per day

    total_cards_reviewed: Mapped[int] = mapped_column(Integer, default=0)
    total_quizzes_completed: Mapped[int] = mapped_column(Integer, default=0)
    total_modules_created: Mapped[int] = mapped_column(Integer, default=0)
    total_study_seconds: Mapped[int] = mapped_column(Integer, default=0)
    total_perfect_quizzes: Mapped[int] = mapped_column(Integer, default=0)
    total_cards_mastered: Mapped[int] = mapped_column(Integer, default=0)

    achievements = mapped_column(JSON, default=list)  # list of achievement IDs

    last_activity_date = mapped_column(Date, nullable=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    module_id: Mapped[uuid.UUID] = mapped_column(PortableUUID(), ForeignKey("learning_modules.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(PortableUUID(), ForeignKey("users.id"), nullable=True)
    session_type: Mapped[str] = mapped_column(String, nullable=False)  # "flashcards" or "quiz"

    # Flashcard session state
    current_card_index: Mapped[int] = mapped_column(Integer, default=0)
    cards_reviewed: Mapped[int] = mapped_column(Integer, default=0)
    card_order = mapped_column(JSON, nullable=True)
    card_results = mapped_column(JSON, nullable=True)

    # Quiz session state
    current_question_index: Mapped[int] = mapped_column(Integer, default=0)
    questions_answered: Mapped[int] = mapped_column(Integer, default=0)
    quiz_answers = mapped_column(JSON, nullable=True)

    # Session metadata
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    total_time_seconds: Mapped[float] = mapped_column(Float, default=0)
