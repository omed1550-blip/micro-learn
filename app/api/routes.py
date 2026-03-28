import logging
import random
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile, File
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import get_db
from app.models.models import LearningModule, Flashcard, QuizQuestion, QuizAttempt, StudySession, User, ManualDeck, ManualCard, PasswordReset
from app.schemas.schemas import (
    GenerateRequest,
    NotesRequest,
    TopicRequest,
    ExplainAgainRequest,
    ReviewRequest,
    QuizSubmitRequest,
    StartSessionRequest,
    UpdateSessionRequest,
    FlashcardSchema,
    LearningModuleSchema,
    LearningModuleListSchema,
    ReviewResponse,
    ProgressSchema,
    QuizAttemptSchema,
    RecommendationSchema,
    ExplainAgainResponse,
    StudySessionSchema,
    CreateDeckRequest,
    UpdateDeckRequest,
    CreateCardRequest,
    UpdateCardRequest,
    ReorderCardsRequest,
    ManualCardReviewRequest,
    ManualCardSchema,
    ManualDeckSchema,
    ManualDeckDetailSchema,
)
from app.services import get_learning_processor
from app.services.exceptions import InvalidURLError, NoTranscriptError, ExtractionError, QuotaExhaustedError
from app.services.extractor import (
    ExtractedContent,
    extract_content,
    extract_from_notes,
    extract_from_image,
    extract_from_pdf,
    extract_from_document,
)
from app.services.review_service import ReviewService
from app.services.activity_service import ActivityService
from app.services.spaced_repetition import calculate_sm2_plus, calculate_next_review_date
from app.services.auth_service import (
    register_email_user,
    authenticate_email_user,
    get_or_create_oauth_user,
    create_access_token,
    hash_password,
)
from app.api.dependencies import require_auth, verify_module_owner

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api")

_MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

_IMAGE_EXTS = {"jpg", "jpeg", "png", "webp", "gif"}
_PDF_EXTS = {"pdf"}
_DOC_EXTS = {"docx", "doc", "txt", "md", "rtf"}


def _user_dict(user: User) -> dict:
    return {"id": str(user.id), "email": user.email, "name": user.name, "image": user.image, "email_verified": user.email_verified}


# ─── Auth endpoints ───


class RegisterRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=8)
    name: str | None = None


class LoginRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1)


class OAuthRequest(BaseModel):
    email: str
    name: str | None = None
    image: str | None = None
    provider: str
    provider_account_id: str


@router.post("/auth/register")
@limiter.limit("5/minute")
async def register(request: RegisterRequest, req: Request, db: AsyncSession = Depends(get_db)):
    if not re.match(r"[^@]+@[^@]+\.[^@]+", request.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    try:
        user = await register_email_user(db, request.email, request.password, request.name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    token = create_access_token(user.id, user.email)
    return {"user": _user_dict(user), "access_token": token}


@router.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: LoginRequest, req: Request, db: AsyncSession = Depends(get_db)):
    user = await authenticate_email_user(db, request.email, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user.id, user.email)
    return {"user": _user_dict(user), "access_token": token}


@router.post("/auth/oauth")
async def oauth_login(request: OAuthRequest, db: AsyncSession = Depends(get_db)):
    user = await get_or_create_oauth_user(
        db, request.email, request.name, request.image,
        request.provider, request.provider_account_id,
    )
    token = create_access_token(user.id, user.email)
    return {"user": _user_dict(user), "access_token": token}


@router.get("/auth/me")
async def get_me(user: User = Depends(require_auth)):
    return {
        "id": str(user.id), "email": user.email, "name": user.name,
        "image": user.image, "email_verified": user.email_verified, "created_at": user.created_at,
    }


# ─── Module generation (auth required) ───


async def _save_module(
    extracted: ExtractedContent,
    db: AsyncSession,
    user: User,
    source_url: str = "",
    generate_flashcards: bool = True,
    generate_quiz: bool = True,
) -> LearningModule:
    processor = get_learning_processor()
    gen_kw = dict(generate_flashcards=generate_flashcards, generate_quiz=generate_quiz)

    if extracted.images and extracted.text:
        ai_output = await processor.generate_hybrid(
            text=extracted.text, images=extracted.images, source_title=extracted.title, **gen_kw
        )
    elif extracted.images:
        ai_output = await processor.generate_from_images(
            images=extracted.images, source_title=extracted.title, **gen_kw
        )
    else:
        ai_output = await processor.generate_learning_module(
            text=extracted.text, source_title=extracted.title, **gen_kw
        )

    module = LearningModule(
        user_id=user.id,
        source_url=source_url or extracted.url,
        source_type=extracted.source_type,
        title=extracted.title,
        summary=ai_output.summary,
        raw_transcript=extracted.text or "[Visual content - see original source]",
        original_filename=extracted.original_filename or None,
        file_size=extracted.file_size or None,
    )
    db.add(module)
    await db.flush()

    now = datetime.now(timezone.utc)
    if generate_flashcards:
        for fc in ai_output.flashcards:
            card = Flashcard(
                module_id=module.id,
                front=fc.front,
                back=fc.back,
                easiness_factor=2.5,
                interval_days=0,
                repetitions=0,
                next_review=now,
            )
            db.add(card)

    if generate_quiz:
        for qq in ai_output.quiz:
            question = QuizQuestion(
                module_id=module.id,
                question=qq.question,
                options=qq.options,
                option_feedbacks=qq.option_feedbacks,
                correct_answer=qq.correct_answer,
                explanation=qq.explanation,
            )
            db.add(question)

    await db.commit()
    await db.refresh(module, ["flashcards", "quiz_questions"])

    # Record activity
    await ActivityService.record_activity(user.id, "module_create", db)
    await db.commit()

    return module


@router.post("/generate", response_model=LearningModuleSchema)
@limiter.limit("10/minute")
async def generate_module(request: GenerateRequest, req: Request, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    try:
        extracted = await extract_content(source_url=str(request.url))
        return await _save_module(
            extracted, db, user, source_url=str(request.url),
            generate_flashcards=request.generate_flashcards,
            generate_quiz=request.generate_quiz,
        )
    except InvalidURLError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NoTranscriptError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except QuotaExhaustedError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except ExtractionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in generate_module")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {type(e).__name__}")


@router.post("/generate/notes", response_model=LearningModuleSchema)
@limiter.limit("10/minute")
async def generate_from_notes(request: NotesRequest, req: Request, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    try:
        extracted = extract_from_notes(title=request.title, content=request.content)
        return await _save_module(
            extracted, db, user,
            generate_flashcards=request.generate_flashcards,
            generate_quiz=request.generate_quiz,
        )
    except QuotaExhaustedError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except ExtractionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in generate_from_notes")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {type(e).__name__}")


@router.post("/generate/upload", response_model=LearningModuleSchema)
@limiter.limit("10/minute")
async def generate_from_upload(
    request: Request,
    file: UploadFile = File(...),
    generate_flashcards: bool = Form(True),
    generate_quiz: bool = Form(True),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    try:
        file_bytes = await file.read()
        filename = file.filename or "upload"
        file_size = len(file_bytes)

        if file_size > _MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File is too large. Maximum 20MB.")

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        if ext in _IMAGE_EXTS:
            extracted = extract_from_image(file_bytes, filename)
        elif ext in _PDF_EXTS:
            extracted = extract_from_pdf(file_bytes, filename)
        elif ext in _DOC_EXTS:
            extracted = extract_from_document(file_bytes, filename)
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Supported: images (jpg, png, webp), PDF, Word documents (.docx), and text files (.txt, .md)",
            )

        extracted.original_filename = filename
        extracted.file_size = file_size
        return await _save_module(
            extracted, db, user,
            generate_flashcards=generate_flashcards,
            generate_quiz=generate_quiz,
        )
    except QuotaExhaustedError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except ExtractionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in generate_from_upload")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {type(e).__name__}")


@router.post("/generate/topic", response_model=LearningModuleSchema)
@limiter.limit("10/minute")
async def generate_from_topic(request: TopicRequest, req: Request, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    try:
        processor = get_learning_processor()
        ai_output = await processor.generate_from_topic(
            topic=request.topic,
            difficulty=request.difficulty,
            generate_flashcards=request.generate_flashcards,
            generate_quiz=request.generate_quiz,
        )

        now = datetime.now(timezone.utc)
        module = LearningModule(
            user_id=user.id,
            source_url="",
            source_type="topic",
            title=request.topic,
            summary=ai_output.summary,
            raw_transcript=f"[AI-generated lesson on: {request.topic}]",
        )
        db.add(module)
        await db.flush()

        if request.generate_flashcards:
            for fc in ai_output.flashcards:
                card = Flashcard(
                    module_id=module.id, front=fc.front, back=fc.back,
                    easiness_factor=2.5, interval_days=0, repetitions=0, next_review=now,
                )
                db.add(card)

        if request.generate_quiz:
            for qq in ai_output.quiz:
                question = QuizQuestion(
                    module_id=module.id, question=qq.question, options=qq.options,
                    option_feedbacks=qq.option_feedbacks, correct_answer=qq.correct_answer,
                    explanation=qq.explanation,
                )
                db.add(question)

        await db.commit()
        await db.refresh(module, ["flashcards", "quiz_questions"])

        await ActivityService.record_activity(user.id, "module_create", db)
        await db.commit()

        return module
    except QuotaExhaustedError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except ExtractionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in generate_from_topic")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {type(e).__name__}")


# ─── Module endpoints (auth required) ───


@router.post("/modules/{module_id}/explain-again", response_model=ExplainAgainResponse)
async def explain_again(module_id: UUID, request: ExplainAgainRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    module = await verify_module_owner(module_id, user, db)
    try:
        processor = get_learning_processor()
        explanation = await processor.explain_again(summary=module.summary, mode=request.mode)
        return ExplainAgainResponse(explanation=explanation)
    except QuotaExhaustedError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except ExtractionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error in explain_again")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {type(e).__name__}")


@router.get("/modules/{module_id}", response_model=LearningModuleSchema)
async def get_module(module_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    result = await db.execute(
        select(LearningModule)
        .where(LearningModule.id == module_id, LearningModule.user_id == user.id)
        .options(selectinload(LearningModule.flashcards), selectinload(LearningModule.quiz_questions))
    )
    module = result.scalar_one_or_none()
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    return module


@router.post("/review")
@limiter.limit("60/minute")
async def review_card(request: ReviewRequest, req: Request, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    try:
        result = await ReviewService.review_card(
            flashcard_id=request.flashcard_id,
            quality=request.quality,
            db=db,
            time_spent_seconds=request.time_spent_seconds,
        )
        action = "card_review_perfect" if request.quality == 5 else "card_review"
        activity = await ActivityService.record_activity(
            user.id, action, db,
            study_seconds=int(request.time_spent_seconds or 0),
        )
        await db.commit()
        return {**result, "activity": activity}
    except ValueError:
        raise HTTPException(status_code=404, detail="Flashcard not found")


@router.get("/modules/{module_id}/due-cards", response_model=list[FlashcardSchema])
async def get_due_cards(module_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await verify_module_owner(module_id, user, db)
    cards = await ReviewService.get_due_cards(module_id=module_id, db=db)
    return cards


@router.get("/modules/{module_id}/progress", response_model=ProgressSchema)
async def get_progress(module_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await verify_module_owner(module_id, user, db)
    progress = await ReviewService.get_progress(module_id=module_id, db=db)
    return progress


@router.post("/modules/{module_id}/submit-quiz")
async def submit_quiz(module_id: UUID, request: QuizSubmitRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await verify_module_owner(module_id, user, db)
    attempt = await ReviewService.submit_quiz(
        module_id=module_id,
        score=request.score,
        total=request.total,
        db=db,
    )
    is_perfect = request.total > 0 and request.score == request.total
    action = "quiz_perfect" if is_perfect else "quiz_complete"
    activity = await ActivityService.record_activity(
        user.id, action, db, is_perfect_quiz=is_perfect,
    )
    await db.commit()
    return {
        "id": str(attempt.id),
        "module_id": str(attempt.module_id),
        "score": attempt.score,
        "total": attempt.total,
        "percentage": attempt.percentage,
        "completed_at": attempt.completed_at,
        "activity": activity,
    }


@router.get("/modules/{module_id}/quiz-history", response_model=list[QuizAttemptSchema])
async def get_quiz_history(module_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await verify_module_owner(module_id, user, db)
    history = await ReviewService.get_quiz_history(module_id=module_id, db=db)
    return history


@router.get("/modules/{module_id}/study-queue", response_model=list[FlashcardSchema])
async def get_study_queue(module_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await verify_module_owner(module_id, user, db)
    queue = await ReviewService.get_study_queue(module_id=module_id, db=db)
    return queue


@router.get("/modules/{module_id}/recommendation", response_model=RecommendationSchema)
async def get_recommendation(module_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await verify_module_owner(module_id, user, db)
    rec = await ReviewService.get_recommendation(module_id=module_id, db=db)
    return rec


@router.get("/modules", response_model=list[LearningModuleListSchema])
async def list_modules(db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    result = await db.execute(
        select(LearningModule)
        .where(LearningModule.user_id == user.id)
        .order_by(LearningModule.created_at.desc())
        .limit(50)
    )
    return list(result.scalars().all())


# ─── Session endpoints (auth required) ───


@router.post("/modules/{module_id}/session/start", response_model=StudySessionSchema)
async def start_session(module_id: UUID, request: StartSessionRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await verify_module_owner(module_id, user, db)

    existing = await db.execute(
        select(StudySession)
        .where(
            StudySession.module_id == module_id,
            StudySession.session_type == request.session_type,
            StudySession.is_completed == False,
        )
        .order_by(StudySession.updated_at.desc())
        .limit(1)
    )
    session = existing.scalar_one_or_none()
    if session:
        return session

    card_order = None
    if request.session_type == "flashcards":
        cards_result = await db.execute(
            select(Flashcard.id).where(Flashcard.module_id == module_id)
        )
        card_order = [str(cid) for cid in cards_result.scalars().all()]

    session = StudySession(
        module_id=module_id,
        user_id=user.id,
        session_type=request.session_type,
        card_order=card_order,
        card_results=[],
        quiz_answers=[],
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.put("/modules/{module_id}/session/{session_id}", response_model=StudySessionSchema)
async def update_session(module_id: UUID, session_id: UUID, request: UpdateSessionRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await verify_module_owner(module_id, user, db)
    result = await db.execute(
        select(StudySession).where(StudySession.id == session_id, StudySession.module_id == module_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    for field in ("current_card_index", "cards_reviewed", "card_results",
                  "current_question_index", "questions_answered", "quiz_answers",
                  "total_time_seconds"):
        value = getattr(request, field)
        if value is not None:
            setattr(session, field, value)

    session.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/modules/{module_id}/session/{session_id}/complete", response_model=StudySessionSchema)
async def complete_session(module_id: UUID, session_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await verify_module_owner(module_id, user, db)
    result = await db.execute(
        select(StudySession).where(StudySession.id == session_id, StudySession.module_id == module_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.is_completed:
        return session

    session.is_completed = True
    session.updated_at = datetime.now(timezone.utc)

    if session.session_type == "quiz" and session.quiz_answers:
        correct = sum(1 for a in session.quiz_answers if a.get("is_correct"))
        total = len(session.quiz_answers)
        if total > 0:
            attempt = QuizAttempt(
                module_id=module_id,
                score=correct,
                total=total,
                percentage=round((correct / total) * 100, 1),
            )
            db.add(attempt)

    await db.commit()
    await db.refresh(session)
    return session


@router.get("/modules/{module_id}/session/active", response_model=StudySessionSchema)
async def get_active_session(module_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await verify_module_owner(module_id, user, db)
    result = await db.execute(
        select(StudySession)
        .where(
            StudySession.module_id == module_id,
            StudySession.is_completed == False,
        )
        .order_by(StudySession.updated_at.desc())
        .limit(1)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="No active session")
    return session


# ─── Activity endpoints (auth required) ───


@router.get("/activity/dashboard")
async def get_activity_dashboard(db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    return await ActivityService.get_dashboard(user.id, db)


@router.get("/activity/calendar")
async def get_activity_calendar(days: int = 365, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    return await ActivityService.get_calendar(user.id, db, days=min(days, 365))


class UpdateGoalRequest(BaseModel):
    daily_goal: int = Field(ge=10, le=500)


@router.put("/activity/goal")
async def update_activity_goal(request: UpdateGoalRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    return await ActivityService.update_daily_goal(user.id, request.daily_goal, db)


# ─── Manual Deck endpoints (auth required) ───


async def _verify_deck_owner(deck_id: UUID, user: User, db: AsyncSession) -> ManualDeck:
    result = await db.execute(
        select(ManualDeck).where(ManualDeck.id == deck_id, ManualDeck.user_id == user.id)
    )
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck


@router.post("/decks", response_model=ManualDeckSchema)
async def create_deck(request: CreateDeckRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    deck = ManualDeck(
        user_id=user.id,
        title=request.title,
        description=request.description or None,
        color=request.color,
        icon=request.icon,
    )
    db.add(deck)
    await db.commit()
    await db.refresh(deck)
    return deck


@router.get("/decks", response_model=list[ManualDeckSchema])
async def list_decks(db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    result = await db.execute(
        select(ManualDeck)
        .where(ManualDeck.user_id == user.id)
        .order_by(ManualDeck.updated_at.desc())
    )
    return list(result.scalars().all())


@router.get("/decks/{deck_id}", response_model=ManualDeckDetailSchema)
async def get_deck(deck_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    result = await db.execute(
        select(ManualDeck)
        .where(ManualDeck.id == deck_id, ManualDeck.user_id == user.id)
        .options(selectinload(ManualDeck.cards))
    )
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck


@router.put("/decks/{deck_id}", response_model=ManualDeckSchema)
async def update_deck(deck_id: UUID, request: UpdateDeckRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    deck = await _verify_deck_owner(deck_id, user, db)
    for field in ("title", "description", "color", "icon"):
        value = getattr(request, field)
        if value is not None:
            setattr(deck, field, value)
    await db.commit()
    await db.refresh(deck)
    return deck


@router.delete("/decks/{deck_id}")
async def delete_deck(deck_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    deck = await _verify_deck_owner(deck_id, user, db)
    await db.delete(deck)
    await db.commit()
    return {"deleted": True}


# ─── Manual Card CRUD ───


_MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB


def _validate_base64_image(data: str) -> None:
    import base64
    try:
        decoded = base64.b64decode(data.split(",")[-1] if "," in data else data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")
    if len(decoded) > _MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image must be less than 5MB")


@router.post("/decks/{deck_id}/cards", response_model=ManualCardSchema)
async def create_card(deck_id: UUID, request: CreateCardRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    deck = await _verify_deck_owner(deck_id, user, db)

    if not request.front_text and not request.front_image:
        raise HTTPException(status_code=400, detail="Front side must have text or an image")
    if not request.back_text and not request.back_image:
        raise HTTPException(status_code=400, detail="Back side must have text or an image")

    if request.front_image:
        _validate_base64_image(request.front_image)
    if request.back_image:
        _validate_base64_image(request.back_image)

    # Get next position
    max_pos_result = await db.execute(
        select(sa_func.max(ManualCard.position)).where(ManualCard.deck_id == deck_id)
    )
    max_pos = max_pos_result.scalar() or -1

    card = ManualCard(
        deck_id=deck_id,
        position=max_pos + 1,
        front_text=request.front_text or None,
        front_image=request.front_image,
        front_image_filename=request.front_image_filename,
        back_text=request.back_text or None,
        back_image=request.back_image,
        back_image_filename=request.back_image_filename,
    )
    db.add(card)
    deck.card_count = (deck.card_count or 0) + 1
    await db.commit()
    await db.refresh(card)

    await ActivityService.record_activity(user.id, "card_create", db)
    await db.commit()

    return card


@router.put("/decks/{deck_id}/cards/{card_id}", response_model=ManualCardSchema)
async def update_card(deck_id: UUID, card_id: UUID, request: UpdateCardRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await _verify_deck_owner(deck_id, user, db)
    result = await db.execute(
        select(ManualCard).where(ManualCard.id == card_id, ManualCard.deck_id == deck_id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    if request.front_image is not None:
        if request.front_image:
            _validate_base64_image(request.front_image)
        card.front_image = request.front_image or None
    if request.back_image is not None:
        if request.back_image:
            _validate_base64_image(request.back_image)
        card.back_image = request.back_image or None

    for field in ("front_text", "front_image_filename", "back_text", "back_image_filename", "position"):
        value = getattr(request, field)
        if value is not None:
            setattr(card, field, value)

    await db.commit()
    await db.refresh(card)
    return card


@router.delete("/decks/{deck_id}/cards/{card_id}")
async def delete_card(deck_id: UUID, card_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    deck = await _verify_deck_owner(deck_id, user, db)
    result = await db.execute(
        select(ManualCard).where(ManualCard.id == card_id, ManualCard.deck_id == deck_id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    deleted_pos = card.position
    await db.delete(card)
    deck.card_count = max(0, (deck.card_count or 0) - 1)

    # Reorder remaining cards to fill the gap
    remaining = await db.execute(
        select(ManualCard)
        .where(ManualCard.deck_id == deck_id, ManualCard.position > deleted_pos)
        .order_by(ManualCard.position.asc())
    )
    for c in remaining.scalars().all():
        c.position -= 1

    await db.commit()
    return {"deleted": True}


@router.post("/decks/{deck_id}/cards/reorder", response_model=list[ManualCardSchema])
async def reorder_cards(deck_id: UUID, request: ReorderCardsRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await _verify_deck_owner(deck_id, user, db)
    result = await db.execute(
        select(ManualCard).where(ManualCard.deck_id == deck_id)
    )
    cards_by_id = {c.id: c for c in result.scalars().all()}

    for idx, card_id in enumerate(request.card_ids):
        if card_id in cards_by_id:
            cards_by_id[card_id].position = idx

    await db.commit()

    # Return updated cards in order
    result = await db.execute(
        select(ManualCard).where(ManualCard.deck_id == deck_id).order_by(ManualCard.position.asc())
    )
    return list(result.scalars().all())


# ─── Manual Card Review (SM-2+) ───


@router.post("/decks/{deck_id}/review", response_model=ManualCardSchema)
async def review_manual_card(deck_id: UUID, request: ManualCardReviewRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await _verify_deck_owner(deck_id, user, db)
    result = await db.execute(
        select(ManualCard).where(ManualCard.id == request.card_id, ManualCard.deck_id == deck_id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    new_reps, new_ef, new_interval, new_lapse = calculate_sm2_plus(
        quality=request.quality,
        repetitions=card.repetitions,
        easiness_factor=card.easiness_factor,
        interval_days=card.interval_days,
        lapse_count=card.lapse_count,
        time_spent_seconds=request.time_spent_seconds,
    )

    card.repetitions = new_reps
    card.easiness_factor = new_ef
    card.interval_days = new_interval
    card.lapse_count = new_lapse
    card.last_quality = request.quality
    card.next_review = calculate_next_review_date(new_interval)
    card.streak = card.streak + 1 if request.quality >= 3 else 0

    action = "manual_card_review_perfect" if request.quality == 5 else "manual_card_review"
    activity = await ActivityService.record_activity(
        user.id, action, db,
        study_seconds=int(request.time_spent_seconds or 0),
    )

    await db.commit()
    await db.refresh(card)
    return {
        "id": str(card.id),
        "deck_id": str(card.deck_id),
        "position": card.position,
        "front_text": card.front_text,
        "front_image": card.front_image,
        "front_image_filename": card.front_image_filename,
        "back_text": card.back_text,
        "back_image": card.back_image,
        "back_image_filename": card.back_image_filename,
        "easiness_factor": card.easiness_factor,
        "interval_days": card.interval_days,
        "repetitions": card.repetitions,
        "next_review": card.next_review,
        "lapse_count": card.lapse_count,
        "last_quality": card.last_quality,
        "streak": card.streak,
        "created_at": card.created_at,
        "updated_at": card.updated_at,
        "activity": activity,
    }


@router.get("/decks/{deck_id}/due-cards", response_model=list[ManualCardSchema])
async def get_deck_due_cards(deck_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await _verify_deck_owner(deck_id, user, db)
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(ManualCard)
        .where(ManualCard.deck_id == deck_id, ManualCard.next_review <= now)
        .order_by(ManualCard.next_review.asc())
    )
    return list(result.scalars().all())


@router.get("/decks/{deck_id}/progress")
async def get_deck_progress(deck_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await _verify_deck_owner(deck_id, user, db)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(ManualCard).where(ManualCard.deck_id == deck_id)
    )
    cards = list(result.scalars().all())

    total = len(cards)
    mastered = sum(1 for c in cards if c.interval_days > 21)
    learning = sum(1 for c in cards if c.repetitions > 0 and c.interval_days <= 21)
    new_cards = sum(1 for c in cards if c.repetitions == 0)

    due_now = 0
    for c in cards:
        review_dt = c.next_review
        if review_dt is None:
            due_now += 1
            continue
        if isinstance(review_dt, str):
            review_dt = datetime.fromisoformat(review_dt)
        if review_dt.tzinfo is None:
            review_dt = review_dt.replace(tzinfo=timezone.utc)
        if review_dt <= now:
            due_now += 1

    overall_mastery = round((mastered / total * 100), 1) if total > 0 else 0.0

    return {
        "total_cards": total,
        "mastered": mastered,
        "learning": learning,
        "new_cards": new_cards,
        "due_now": due_now,
        "overall_mastery": overall_mastery,
    }


@router.get("/decks/{deck_id}/study-queue", response_model=list[ManualCardSchema])
async def get_deck_study_queue(deck_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_auth)):
    await _verify_deck_owner(deck_id, user, db)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(ManualCard).where(ManualCard.deck_id == deck_id)
    )
    all_cards = list(result.scalars().all())

    failed = [c for c in all_cards if c.last_quality is not None and c.last_quality < 3 and c.repetitions == 0]
    failed_ids = {c.id for c in failed}

    new_cards = [c for c in all_cards if c.repetitions == 0 and c.id not in failed_ids]

    overdue = []
    for c in all_cards:
        if c.repetitions > 0 and c.id not in failed_ids:
            review_dt = c.next_review
            if review_dt is None:
                overdue.append(c)
                continue
            if isinstance(review_dt, str):
                review_dt = datetime.fromisoformat(review_dt)
            if review_dt.tzinfo is None:
                review_dt = review_dt.replace(tzinfo=timezone.utc)
            if review_dt <= now:
                overdue.append(c)
    def _sort_key(c):
        nr = c.next_review
        if nr is None:
            return datetime.min.replace(tzinfo=timezone.utc)
        if isinstance(nr, str):
            nr = datetime.fromisoformat(nr)
        if nr.tzinfo is None:
            nr = nr.replace(tzinfo=timezone.utc)
        return nr
    overdue.sort(key=_sort_key)

    queue: list[ManualCard] = list(failed)
    new_iter = iter(new_cards[:5])
    overdue_iter = iter(overdue)

    while len(queue) < 20:
        added = False
        try:
            queue.append(next(overdue_iter))
            added = True
        except StopIteration:
            pass
        try:
            queue.append(next(new_iter))
            added = True
        except StopIteration:
            pass
        if not added:
            break

    return queue[:20]


# ─── Password Reset ───


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=1)


class ResetPasswordRequest(BaseModel):
    email: str = Field(min_length=1)
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8)


@router.post("/auth/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: ForgotPasswordRequest, req: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if user:
        code = f"{random.randint(0, 999999):06d}"
        reset = PasswordReset(
            user_id=user.id,
            code=code,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
        db.add(reset)
        await db.commit()
        logger.info(f"Password reset code for {request.email}: {code}")

    return {"message": "If this email exists, a reset code has been sent"}


@router.post("/auth/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: ResetPasswordRequest, req: Request, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(PasswordReset)
        .join(User, PasswordReset.user_id == User.id)
        .where(
            User.email == request.email,
            PasswordReset.code == request.code,
            PasswordReset.used == False,
            PasswordReset.expires_at > now,
        )
        .order_by(PasswordReset.created_at.desc())
        .limit(1)
    )
    reset = result.scalar_one_or_none()
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")

    user_result = await db.execute(select(User).where(User.id == reset.user_id))
    user = user_result.scalar_one()
    user.hashed_password = hash_password(request.new_password)
    reset.used = True
    await db.commit()

    return {"message": "Password reset successfully"}
