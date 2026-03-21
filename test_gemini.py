import asyncio
from app.services.learning_processor import LearningProcessor
from app.config import settings

async def test():
    processor = LearningProcessor(api_key=settings.GEMINI_API_KEY)
    sample_text = "Spaced repetition is a learning technique where you review information at increasing intervals. The SM-2 algorithm uses an Easiness Factor starting at 2.5. If you answer correctly intervals grow: 1 day, 6 days, then multiplied by EF. If you fail the card resets to 1 day. The EF decreases but never below 1.3. This technique is used in apps like Anki."
    try:
        result = await processor.generate_learning_module(sample_text, "Spaced Repetition")
        print(f"SUCCESS! Flashcards: {len(result.flashcards)}, Quiz: {len(result.quiz)}")
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

asyncio.run(test())
