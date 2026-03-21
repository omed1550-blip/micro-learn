/**
 * Frontend SM-2+ calculation for offline flashcard reviews.
 * Server is the source of truth — this provides immediate UI feedback only.
 */
export function calculateNextReview(
  quality: number,
  repetitions: number,
  easinessFactor: number,
  intervalDays: number
): { repetitions: number; easinessFactor: number; intervalDays: number } {
  let newEf = easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEf = Math.max(newEf, 1.3);

  let newInterval: number;
  let newReps: number;

  if (quality >= 3) {
    if (repetitions === 0) newInterval = 1;
    else if (repetitions === 1) newInterval = 3;
    else if (repetitions === 2) newInterval = 7;
    else newInterval = Math.round(intervalDays * newEf);
    newReps = repetitions + 1;
  } else {
    newReps = 0;
    newInterval = 1;
  }

  return { repetitions: newReps, easinessFactor: newEf, intervalDays: newInterval };
}
