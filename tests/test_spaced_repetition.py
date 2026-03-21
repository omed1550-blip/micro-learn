from datetime import datetime, timedelta, timezone

import pytest

from app.services.spaced_repetition import calculate_sm2_plus, calculate_next_review_date


# --- Core Algorithm Tests (SM-2+) ---

def test_first_correct_review():
    reps, ef, interval, lapse = calculate_sm2_plus(quality=4, repetitions=0, easiness_factor=2.5, interval_days=0)
    assert reps == 1
    assert interval == 1
    assert ef == pytest.approx(2.5, abs=0.05)
    assert lapse == 0


def test_second_correct_review():
    reps, ef, interval, lapse = calculate_sm2_plus(quality=4, repetitions=1, easiness_factor=2.5, interval_days=1)
    assert reps == 2
    assert interval == 3


def test_third_correct_review():
    reps, ef, interval, lapse = calculate_sm2_plus(quality=4, repetitions=2, easiness_factor=2.5, interval_days=3)
    assert reps == 3
    assert interval == 7


def test_fourth_correct_review():
    # After third review get EF
    _, ef_after_3, _, _ = calculate_sm2_plus(quality=4, repetitions=2, easiness_factor=2.5, interval_days=3)
    reps, ef, interval, lapse = calculate_sm2_plus(quality=4, repetitions=3, easiness_factor=ef_after_3, interval_days=7)
    assert reps == 4
    assert interval == round(7 * ef)


def test_perfect_score_increases_ef():
    _, new_ef, _, _ = calculate_sm2_plus(quality=5, repetitions=2, easiness_factor=2.5, interval_days=3)
    assert new_ef > 2.5


def test_quality_3_decreases_ef():
    _, new_ef, _, _ = calculate_sm2_plus(quality=3, repetitions=2, easiness_factor=2.5, interval_days=3)
    assert new_ef < 2.5


def test_fail_resets_repetitions():
    reps, _, interval, lapse = calculate_sm2_plus(quality=2, repetitions=5, easiness_factor=2.5, interval_days=60)
    assert reps == 0
    assert interval == 1
    assert lapse == 1


def test_fail_quality_1():
    reps, _, interval, lapse = calculate_sm2_plus(quality=1, repetitions=3, easiness_factor=2.5, interval_days=15)
    assert reps == 0
    assert interval == 1
    assert lapse == 1


def test_fail_quality_0_blackout():
    reps, new_ef, interval, lapse = calculate_sm2_plus(quality=0, repetitions=3, easiness_factor=2.5, interval_days=15)
    assert reps == 0
    assert interval == 1
    assert new_ef < 2.5
    assert lapse == 1


def test_ef_floor_never_below_1_3():
    _, new_ef, _, _ = calculate_sm2_plus(quality=0, repetitions=0, easiness_factor=1.3, interval_days=1)
    assert new_ef >= 1.3


def test_ef_floor_with_repeated_failures():
    ef = 2.5
    reps = 0
    interval = 0
    lapse = 0
    for _ in range(10):
        reps, ef, interval, lapse = calculate_sm2_plus(
            quality=0, repetitions=reps, easiness_factor=ef,
            interval_days=interval, lapse_count=lapse,
        )
        assert ef >= 1.3


def test_interval_progression_perfect_user():
    reps, ef, interval, lapse = 0, 2.5, 0, 0
    intervals = []
    for _ in range(6):
        reps, ef, interval, lapse = calculate_sm2_plus(
            quality=5, repetitions=reps, easiness_factor=ef,
            interval_days=interval, lapse_count=lapse,
        )
        intervals.append(interval)
    assert intervals[0] == 1
    assert intervals[1] == 3
    assert intervals[2] == 7
    # Each subsequent interval should be larger than the previous
    for i in range(2, len(intervals)):
        assert intervals[i] > intervals[i - 1]
    # EF should have increased
    assert ef > 2.5


def test_interval_progression_struggling_user():
    reps, ef, interval, lapse = 0, 2.5, 0, 0
    qualities = [5, 5, 2, 5, 5, 2, 5, 5]
    initial_ef = ef
    for q in qualities:
        reps, ef, interval, lapse = calculate_sm2_plus(
            quality=q, repetitions=reps, easiness_factor=ef,
            interval_days=interval, lapse_count=lapse,
        )
        if q < 3:
            assert interval == 1
            assert reps == 0
    # EF should have decreased overall due to failures
    assert ef < initial_ef


def test_quality_boundary_3_is_pass():
    reps, _, interval, _ = calculate_sm2_plus(quality=3, repetitions=0, easiness_factor=2.5, interval_days=0)
    assert reps == 1
    assert interval == 1


def test_quality_boundary_2_is_fail():
    reps, _, interval, _ = calculate_sm2_plus(quality=2, repetitions=0, easiness_factor=2.5, interval_days=0)
    assert reps == 0
    assert interval == 1


# --- SM-2+ specific tests ---

def test_lapse_count_increments_on_fail():
    _, _, _, lapse = calculate_sm2_plus(quality=1, repetitions=3, easiness_factor=2.5, interval_days=15, lapse_count=2)
    assert lapse == 3


def test_leech_penalty_applied():
    """Cards with lapse_count >= 3 should get penalty on intervals."""
    _, _, interval_normal, _ = calculate_sm2_plus(quality=5, repetitions=3, easiness_factor=2.5, interval_days=7, lapse_count=0)
    _, _, interval_leech, _ = calculate_sm2_plus(quality=5, repetitions=3, easiness_factor=2.5, interval_days=7, lapse_count=5)
    assert interval_leech < interval_normal


def test_time_bonus_fast_answer():
    """Fast answers (< 3s) should slightly increase EF."""
    _, ef_normal, _, _ = calculate_sm2_plus(quality=4, repetitions=2, easiness_factor=2.5, interval_days=3, time_spent_seconds=0)
    _, ef_fast, _, _ = calculate_sm2_plus(quality=4, repetitions=2, easiness_factor=2.5, interval_days=3, time_spent_seconds=2)
    assert ef_fast > ef_normal


def test_time_penalty_slow_answer():
    """Slow answers (> 15s) should slightly decrease EF."""
    _, ef_normal, _, _ = calculate_sm2_plus(quality=4, repetitions=2, easiness_factor=2.5, interval_days=3, time_spent_seconds=0)
    _, ef_slow, _, _ = calculate_sm2_plus(quality=4, repetitions=2, easiness_factor=2.5, interval_days=3, time_spent_seconds=20)
    assert ef_slow < ef_normal


# --- calculate_next_review_date Tests ---

def test_next_review_date_1_day():
    result = calculate_next_review_date(1)
    expected = datetime.now(timezone.utc) + timedelta(days=1)
    assert abs((result - expected).total_seconds()) < 5


def test_next_review_date_30_days():
    result = calculate_next_review_date(30)
    expected = datetime.now(timezone.utc) + timedelta(days=30)
    assert abs((result - expected).total_seconds()) < 5
