import logging
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import DailyActivity, UserStats

logger = logging.getLogger(__name__)

# XP rewards per action
XP_REWARDS = {
    "card_review": 10,
    "card_review_perfect": 15,  # quality 5
    "quiz_complete": 25,
    "quiz_perfect": 50,  # 100% score
    "module_create": 30,
    "card_create": 5,
    "manual_card_review": 10,
    "manual_card_review_perfect": 15,
}

# Level thresholds (total XP needed)
LEVEL_THRESHOLDS = [
    0,      # Level 1
    100,    # Level 2
    300,    # Level 3
    600,    # Level 4
    1000,   # Level 5
    1500,   # Level 6
    2200,   # Level 7
    3000,   # Level 8
    4000,   # Level 9
    5200,   # Level 10
    6600,   # Level 11
    8200,   # Level 12
    10000,  # Level 13
    12000,  # Level 14
    14500,  # Level 15
    17500,  # Level 16
    21000,  # Level 17
    25000,  # Level 18
    30000,  # Level 19
    36000,  # Level 20
]

# Achievements
ACHIEVEMENTS = [
    {"id": "first_review", "name": "First Steps", "description": "Review your first card", "icon": "star", "condition": "total_cards_reviewed >= 1"},
    {"id": "ten_reviews", "name": "Getting Started", "description": "Review 10 cards", "icon": "zap", "condition": "total_cards_reviewed >= 10"},
    {"id": "hundred_reviews", "name": "Card Shark", "description": "Review 100 cards", "icon": "flame", "condition": "total_cards_reviewed >= 100"},
    {"id": "five_hundred_reviews", "name": "Review Machine", "description": "Review 500 cards", "icon": "rocket", "condition": "total_cards_reviewed >= 500"},
    {"id": "thousand_reviews", "name": "Grand Master", "description": "Review 1000 cards", "icon": "crown", "condition": "total_cards_reviewed >= 1000"},
    {"id": "first_quiz", "name": "Quiz Taker", "description": "Complete your first quiz", "icon": "clipboard", "condition": "total_quizzes_completed >= 1"},
    {"id": "ten_quizzes", "name": "Quiz Champion", "description": "Complete 10 quizzes", "icon": "award", "condition": "total_quizzes_completed >= 10"},
    {"id": "perfect_quiz", "name": "Perfectionist", "description": "Get 100% on a quiz", "icon": "target", "condition": "total_perfect_quizzes >= 1"},
    {"id": "five_perfect", "name": "Flawless", "description": "Get 100% on 5 quizzes", "icon": "diamond", "condition": "total_perfect_quizzes >= 5"},
    {"id": "first_module", "name": "Creator", "description": "Create your first module", "icon": "plus-circle", "condition": "total_modules_created >= 1"},
    {"id": "five_modules", "name": "Builder", "description": "Create 5 modules", "icon": "layers", "condition": "total_modules_created >= 5"},
    {"id": "ten_modules", "name": "Architect", "description": "Create 10 modules", "icon": "building", "condition": "total_modules_created >= 10"},
    {"id": "streak_3", "name": "On Fire", "description": "3-day streak", "icon": "flame", "condition": "current_streak >= 3"},
    {"id": "streak_7", "name": "Week Warrior", "description": "7-day streak", "icon": "calendar", "condition": "current_streak >= 7"},
    {"id": "streak_14", "name": "Fortnight Force", "description": "14-day streak", "icon": "shield", "condition": "current_streak >= 14"},
    {"id": "streak_30", "name": "Monthly Master", "description": "30-day streak", "icon": "trophy", "condition": "current_streak >= 30"},
    {"id": "streak_100", "name": "Unstoppable", "description": "100-day streak", "icon": "zap", "condition": "current_streak >= 100"},
    {"id": "level_5", "name": "Rising Star", "description": "Reach level 5", "icon": "star", "condition": "level >= 5"},
    {"id": "level_10", "name": "Scholar", "description": "Reach level 10", "icon": "graduation-cap", "condition": "level >= 10"},
    {"id": "level_20", "name": "Legendary", "description": "Reach level 20", "icon": "crown", "condition": "level >= 20"},
]


def _calculate_level(total_xp: int) -> int:
    level = 1
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if total_xp >= threshold:
            level = i + 1
        else:
            break
    return level


def _xp_for_next_level(level: int) -> int:
    if level >= len(LEVEL_THRESHOLDS):
        return LEVEL_THRESHOLDS[-1] + 10000
    return LEVEL_THRESHOLDS[level]  # level is 1-indexed, so LEVEL_THRESHOLDS[level] = next level's threshold


def _streak_multiplier(streak: int) -> float:
    """10% bonus per streak day, max 100% (2x)."""
    return min(2.0, 1.0 + streak * 0.1)


def _check_achievements(stats: UserStats) -> list[dict]:
    """Check which new achievements have been unlocked."""
    existing = set(stats.achievements or [])
    new_achievements = []

    for ach in ACHIEVEMENTS:
        if ach["id"] in existing:
            continue
        condition = ach["condition"]
        # Parse simple conditions like "total_cards_reviewed >= 1"
        parts = condition.split()
        if len(parts) == 3:
            field, op, value = parts
            stat_val = getattr(stats, field, 0)
            target = int(value)
            if op == ">=" and stat_val >= target:
                new_achievements.append(ach)

    return new_achievements


class ActivityService:

    @staticmethod
    async def get_or_create_stats(user_id: UUID, db: AsyncSession) -> UserStats:
        result = await db.execute(
            select(UserStats).where(UserStats.user_id == user_id)
        )
        stats = result.scalar_one_or_none()
        if not stats:
            stats = UserStats(user_id=user_id)
            db.add(stats)
            await db.flush()
        return stats

    @staticmethod
    async def get_or_create_daily(user_id: UUID, activity_date: date, db: AsyncSession) -> DailyActivity:
        result = await db.execute(
            select(DailyActivity).where(
                and_(DailyActivity.user_id == user_id, DailyActivity.date == activity_date)
            )
        )
        daily = result.scalar_one_or_none()
        if not daily:
            daily = DailyActivity(user_id=user_id, date=activity_date)
            db.add(daily)
            await db.flush()
        return daily

    @staticmethod
    async def record_activity(
        user_id: UUID,
        action: str,
        db: AsyncSession,
        extra_xp: int = 0,
        study_seconds: int = 0,
        is_perfect_quiz: bool = False,
    ) -> dict:
        """Record an activity and return XP/level/achievement info."""
        today = date.today()
        stats = await ActivityService.get_or_create_stats(user_id, db)
        daily = await ActivityService.get_or_create_daily(user_id, today, db)

        # Calculate base XP
        base_xp = XP_REWARDS.get(action, 0) + extra_xp

        # Apply streak multiplier
        multiplier = _streak_multiplier(stats.current_streak)
        xp_earned = int(base_xp * multiplier)

        # Update daily activity
        daily.xp_earned += xp_earned
        daily.study_seconds += study_seconds

        if action in ("card_review", "card_review_perfect", "manual_card_review", "manual_card_review_perfect"):
            daily.cards_reviewed += 1
        elif action in ("quiz_complete", "quiz_perfect"):
            daily.quizzes_completed += 1
        elif action == "module_create":
            daily.modules_created += 1
        elif action == "card_create":
            daily.cards_created += 1

        # Update streak
        yesterday = today - timedelta(days=1)
        if stats.last_activity_date is None or stats.last_activity_date < yesterday:
            # Streak broken or first activity
            if stats.last_activity_date == yesterday:
                pass  # continuing streak
            else:
                stats.current_streak = 0
        if stats.last_activity_date != today:
            stats.current_streak += 1
        stats.last_activity_date = today
        if stats.current_streak > stats.longest_streak:
            stats.longest_streak = stats.current_streak

        # Update lifetime stats
        old_level = stats.level
        stats.total_xp += xp_earned
        stats.total_study_seconds += study_seconds

        if action in ("card_review", "card_review_perfect", "manual_card_review", "manual_card_review_perfect"):
            stats.total_cards_reviewed += 1
        elif action in ("quiz_complete", "quiz_perfect"):
            stats.total_quizzes_completed += 1
            if is_perfect_quiz:
                stats.total_perfect_quizzes += 1
        elif action == "module_create":
            stats.total_modules_created += 1

        # Calculate new level
        new_level = _calculate_level(stats.total_xp)
        stats.level = new_level
        level_up = new_level > old_level

        # Check achievements
        new_achievements = _check_achievements(stats)
        if new_achievements:
            current = list(stats.achievements or [])
            current.extend([a["id"] for a in new_achievements])
            stats.achievements = current

        await db.flush()

        return {
            "xp_earned": xp_earned,
            "total_xp": stats.total_xp,
            "level": stats.level,
            "level_up": level_up,
            "new_level": new_level if level_up else None,
            "streak": stats.current_streak,
            "multiplier": multiplier,
            "new_achievements": [{"id": a["id"], "name": a["name"], "description": a["description"], "icon": a["icon"]} for a in new_achievements],
            "daily_xp": daily.xp_earned,
            "daily_goal": stats.daily_goal,
            "daily_goal_met": daily.xp_earned >= stats.daily_goal,
        }

    @staticmethod
    async def get_dashboard(user_id: UUID, db: AsyncSession) -> dict:
        stats = await ActivityService.get_or_create_stats(user_id, db)
        today = date.today()

        # Check if streak is still active
        if stats.last_activity_date and stats.last_activity_date < today - timedelta(days=1):
            stats.current_streak = 0
            await db.flush()

        # Today's activity
        daily = await ActivityService.get_or_create_daily(user_id, today, db)

        # Level progress
        current_level_xp = LEVEL_THRESHOLDS[stats.level - 1] if stats.level <= len(LEVEL_THRESHOLDS) else LEVEL_THRESHOLDS[-1]
        next_level_xp = _xp_for_next_level(stats.level)
        xp_in_level = stats.total_xp - current_level_xp
        xp_needed = next_level_xp - current_level_xp

        # Streak at risk check
        streak_at_risk = (
            stats.current_streak >= 3
            and stats.last_activity_date == today - timedelta(days=1)
            and daily.xp_earned == 0
        )

        return {
            "streak": stats.current_streak,
            "longest_streak": stats.longest_streak,
            "streak_at_risk": streak_at_risk,
            "level": stats.level,
            "total_xp": stats.total_xp,
            "xp_in_level": xp_in_level,
            "xp_needed": xp_needed,
            "daily_xp": daily.xp_earned,
            "daily_goal": stats.daily_goal,
            "daily_goal_met": daily.xp_earned >= stats.daily_goal,
            "today_cards_reviewed": daily.cards_reviewed,
            "today_quizzes": daily.quizzes_completed,
            "today_modules": daily.modules_created,
            "today_study_seconds": daily.study_seconds,
            "lifetime": {
                "total_cards_reviewed": stats.total_cards_reviewed,
                "total_quizzes_completed": stats.total_quizzes_completed,
                "total_modules_created": stats.total_modules_created,
                "total_study_seconds": stats.total_study_seconds,
                "total_perfect_quizzes": stats.total_perfect_quizzes,
            },
            "achievements": [
                {**ach, "unlocked": ach["id"] in (stats.achievements or [])}
                for ach in ACHIEVEMENTS
            ],
            "multiplier": _streak_multiplier(stats.current_streak),
        }

    @staticmethod
    async def get_calendar(user_id: UUID, db: AsyncSession, days: int = 365) -> list[dict]:
        start_date = date.today() - timedelta(days=days)
        result = await db.execute(
            select(DailyActivity)
            .where(and_(DailyActivity.user_id == user_id, DailyActivity.date >= start_date))
            .order_by(DailyActivity.date.asc())
        )
        activities = result.scalars().all()
        return [
            {
                "date": a.date.isoformat(),
                "xp": a.xp_earned,
                "cards": a.cards_reviewed,
                "quizzes": a.quizzes_completed,
                "modules": a.modules_created,
                "seconds": a.study_seconds,
            }
            for a in activities
        ]

    @staticmethod
    async def update_daily_goal(user_id: UUID, goal: int, db: AsyncSession) -> dict:
        stats = await ActivityService.get_or_create_stats(user_id, db)
        stats.daily_goal = max(10, min(500, goal))  # clamp between 10-500
        await db.commit()
        return {"daily_goal": stats.daily_goal}
