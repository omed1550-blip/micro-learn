from datetime import datetime, timedelta, timezone


def calculate_sm2_plus(
    quality: int,
    repetitions: int,
    easiness_factor: float,
    interval_days: int,
    lapse_count: int = 0,
    time_spent_seconds: float = 0,
) -> tuple[int, float, int, int]:
    """
    Enhanced SM-2+ algorithm.

    Returns: (new_repetitions, new_ef, new_interval, new_lapse_count)

    Improvements over basic SM-2:

    1. SMARTER INITIAL INTERVALS:
       - Rep 0: 1 day
       - Rep 1: 3 days (extra early review for reinforcement)
       - Rep 2: 7 days (one week checkpoint)
       - Rep 3+: interval * EF

    2. LAPSE PENALTY:
       - Cards failed 3+ times get interval reduced by 10% per extra lapse (max 50% reduction)
       - Prevents "leech" cards that keep being forgotten

    3. TIME-BASED ADJUSTMENT:
       - Fast correct answer (< 3 sec): EF bonus +0.05 (truly easy)
       - Slow correct answer (> 15 sec): EF penalty -0.03 (got lucky)

    4. EF FLOOR stays at 1.3 (same as SM-2)
    """

    # Step 1: Update EF
    new_ef = easiness_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))

    # Time-based adjustment
    if quality >= 3 and time_spent_seconds > 0:
        if time_spent_seconds < 3:
            new_ef += 0.05
        elif time_spent_seconds > 15:
            new_ef -= 0.03

    new_ef = max(new_ef, 1.3)

    new_lapse_count = lapse_count

    # Step 2: Calculate interval
    if quality >= 3:  # PASS
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 3
        elif repetitions == 2:
            new_interval = 7
        else:
            new_interval = round(interval_days * new_ef)

        # Lapse penalty for leech cards
        if new_lapse_count >= 3:
            penalty = max(0.5, 1.0 - (new_lapse_count - 2) * 0.1)
            new_interval = max(1, round(new_interval * penalty))

        new_repetitions = repetitions + 1

    else:  # FAIL
        new_repetitions = 0
        new_interval = 1
        new_lapse_count += 1

    return (new_repetitions, new_ef, new_interval, new_lapse_count)


def calculate_next_review_date(interval_days: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=interval_days)
