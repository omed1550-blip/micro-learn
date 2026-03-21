def get_learning_processor():
    from app.config import settings
    from app.services.learning_processor import LearningProcessor
    return LearningProcessor(api_key=settings.GEMINI_API_KEY)
