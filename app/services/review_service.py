from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Flashcard, QuizAttempt, QuizQuestion, ReviewLog
from app.services.spaced_repetition import calculate_sm2_plus, calculate_next_review_date


class ReviewService:

    @staticmethod
    async def review_card(
        flashcard_id: UUID,
        quality: int,
        db: AsyncSession,
        user_id: UUID | None = None,
        time_spent_seconds: float = 0,
    ) -> dict:
        result = await db.execute(select(Flashcard).where(Flashcard.id == flashcard_id))
        card = result.scalar_one_or_none()
        if card is None:
            raise ValueError("Flashcard not found")

        new_repetitions, new_ef, new_interval, new_lapse_count = calculate_sm2_plus(
            quality=quality,
            repetitions=card.repetitions,
            easiness_factor=card.easiness_factor,
            interval_days=card.interval_days,
            lapse_count=card.lapse_count or 0,
            time_spent_seconds=time_spent_seconds,
        )
        next_review = calculate_next_review_date(new_interval)

        card.repetitions = new_repetitions
        card.easiness_factor = new_ef
        card.interval_days = new_interval
        card.lapse_count = new_lapse_count
        card.last_quality = quality
        card.next_review = next_review

        log = ReviewLog(
            flashcard_id=flashcard_id,
            user_id=user_id,
            quality=quality,
            reviewed_at=datetime.now(timezone.utc),
        )
        db.add(log)
        await db.commit()

        return {
            "flashcard_id": flashcard_id,
            "new_easiness_factor": new_ef,
            "new_interval_days": new_interval,
            "new_lapse_count": new_lapse_count,
            "next_review": next_review,
        }

    @staticmethod
    async def get_due_cards(
        module_id: UUID,
        db: AsyncSession,
        user_id: UUID | None = None,
    ) -> list:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(Flashcard)
            .where(Flashcard.module_id == module_id)
            .where(Flashcard.next_review <= now)
            .order_by(Flashcard.next_review.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_study_queue(
        module_id: UUID,
        db: AsyncSession,
        max_cards: int = 20,
    ) -> list[Flashcard]:
        """
        Returns cards in optimal study order:
        1. Failed last time (quality < 3 last review) - highest priority
        2. New cards never reviewed (limit 5 per session to avoid overwhelm)
        3. Overdue cards (most overdue first)
        4. Cards due today

        Interleave: don't show all new cards in a row.
        """
        now = datetime.now(timezone.utc)

        result = await db.execute(
            select(Flashcard).where(Flashcard.module_id == module_id)
        )
        all_cards = list(result.scalars().all())

        failed_ids: set[UUID] = set()
        failed = []
        for c in all_cards:
            if c.last_quality is not None and c.last_quality < 3 and c.repetitions == 0:
                failed.append(c)
                failed_ids.add(c.id)

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
        overdue.sort(key=lambda c: c.next_review or datetime.min.replace(tzinfo=timezone.utc))

        # Build queue: failed first, then interleave new and overdue
        queue: list[Flashcard] = []
        queue.extend(failed)

        new_iter = iter(new_cards[:5])  # max 5 new per session
        overdue_iter = iter(overdue)

        while len(queue) < max_cards:
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

        return queue[:max_cards]

    @staticmethod
    async def get_recommendation(
        module_id: UUID,
        db: AsyncSession,
    ) -> dict:
        """
        Returns a study recommendation for the module.
        """
        now = datetime.now(timezone.utc)

        # Count due cards
        due_result = await db.execute(
            select(sa_func.count())
            .select_from(Flashcard)
            .where(Flashcard.module_id == module_id)
            .where(Flashcard.next_review <= now)
        )
        cards_due = due_result.scalar() or 0

        # Count total flashcards
        total_result = await db.execute(
            select(sa_func.count())
            .select_from(Flashcard)
            .where(Flashcard.module_id == module_id)
        )
        total_cards = total_result.scalar() or 0

        # Count mastered
        mastered_result = await db.execute(
            select(sa_func.count())
            .select_from(Flashcard)
            .where(Flashcard.module_id == module_id)
            .where(Flashcard.interval_days > 21)
        )
        mastered = mastered_result.scalar() or 0

        # Quiz stats
        quiz_result = await db.execute(
            select(
                sa_func.count(),
                sa_func.max(QuizAttempt.percentage),
            )
            .where(QuizAttempt.module_id == module_id)
        )
        row = quiz_result.one()
        quiz_attempt_count = row[0] or 0
        best_quiz = row[1] or 0.0

        # Estimate minutes: ~30 seconds per card
        estimated_minutes = max(1, round(cards_due * 0.5))

        if cards_due > 0:
            return {
                "action": "review_flashcards",
                "reason": f"You have {cards_due} card{'s' if cards_due != 1 else ''} due for review",
                "estimated_minutes": estimated_minutes,
                "cards_due": cards_due,
            }
        elif quiz_attempt_count == 0 or best_quiz < 70:
            return {
                "action": "take_quiz",
                "reason": "Take the quiz to test your knowledge"
                if quiz_attempt_count == 0
                else "Try to improve your quiz score above 70%",
                "estimated_minutes": 5,
                "cards_due": 0,
            }
        elif total_cards > 0 and mastered >= total_cards:
            return {
                "action": "all_mastered",
                "reason": "All flashcards mastered! Come back tomorrow for review.",
                "estimated_minutes": 0,
                "cards_due": 0,
            }
        else:
            return {
                "action": "review_flashcards",
                "reason": "Keep reviewing to master all cards",
                "estimated_minutes": estimated_minutes,
                "cards_due": cards_due,
            }

    @staticmethod
    async def submit_quiz(
        module_id: UUID,
        score: int,
        total: int,
        db: AsyncSession,
        user_id: UUID | None = None,
    ) -> QuizAttempt:
        percentage = round((score / total) * 100, 1) if total > 0 else 0.0
        attempt = QuizAttempt(
            module_id=module_id,
            user_id=user_id,
            score=score,
            total=total,
            percentage=percentage,
        )
        db.add(attempt)
        await db.commit()
        await db.refresh(attempt)
        return attempt

    @staticmethod
    async def get_quiz_history(
        module_id: UUID,
        db: AsyncSession,
    ) -> list[QuizAttempt]:
        result = await db.execute(
            select(QuizAttempt)
            .where(QuizAttempt.module_id == module_id)
            .order_by(QuizAttempt.completed_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_progress(
        module_id: UUID,
        db: AsyncSession,
    ) -> dict:
        now = datetime.now(timezone.utc)

        # Flashcard stats
        result = await db.execute(
            select(Flashcard).where(Flashcard.module_id == module_id)
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

        # Quiz stats
        quiz_q_result = await db.execute(
            select(sa_func.count())
            .select_from(QuizQuestion)
            .where(QuizQuestion.module_id == module_id)
        )
        total_quiz_questions = quiz_q_result.scalar() or 0

        quiz_a_result = await db.execute(
            select(
                sa_func.count(),
                sa_func.max(QuizAttempt.percentage),
            )
            .where(QuizAttempt.module_id == module_id)
        )
        row = quiz_a_result.one()
        quiz_attempt_count = row[0] or 0
        best_quiz_score = row[1] or 0.0

        # Overall mastery
        flashcard_mastery = (mastered / total * 100) if total > 0 else 0.0
        has_flashcards = total > 0
        has_quiz = total_quiz_questions > 0

        if has_flashcards and has_quiz and quiz_attempt_count > 0:
            overall_mastery = round(flashcard_mastery * 0.6 + best_quiz_score * 0.4, 1)
        elif has_flashcards:
            overall_mastery = round(flashcard_mastery, 1)
        elif has_quiz and quiz_attempt_count > 0:
            overall_mastery = round(best_quiz_score, 1)
        else:
            overall_mastery = 0.0

        return {
            "total_cards": total,
            "mastered": mastered,
            "learning": learning,
            "new_cards": new_cards,
            "due_now": due_now,
            "total_quiz_questions": total_quiz_questions,
            "quiz_attempts": quiz_attempt_count,
            "best_quiz_score": best_quiz_score,
            "overall_mastery": overall_mastery,
        }
