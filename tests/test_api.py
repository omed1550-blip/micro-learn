import json
from unittest.mock import patch, AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.schemas import GeminiOutput, FlashcardAI, QuizQuestionAI
from app.services.extractor import ExtractedContent

client = TestClient(app, raise_server_exceptions=False)


def _mock_gemini_output():
    return GeminiOutput(
        summary="This is a test summary of the content for learning purposes.",
        flashcards=[
            FlashcardAI(front=f"Question {i}?", back=f"Answer {i}.") for i in range(5)
        ],
        quiz=[
            QuizQuestionAI(
                question=f"Quiz question {i}?",
                options=["A", "B", "C", "D"],
                option_feedbacks=["Feedback A", "Feedback B", "Feedback C", "Feedback D"],
                correct_answer=i % 4,
                explanation=f"Explanation {i}.",
            )
            for i in range(3)
        ],
    )


def _mock_extracted_content():
    return ExtractedContent(
        source_type="youtube",
        title="Test Video Title",
        text="This is some extracted content from a video about testing." * 10,
        url="https://www.youtube.com/watch?v=test123test",
    )


def test_health_check():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"


def test_generate_invalid_url():
    resp = client.post("/api/generate", json={"url": "not-a-url"})
    assert resp.status_code == 400


def test_generate_empty_url():
    resp = client.post("/api/generate", json={"url": ""})
    assert resp.status_code == 422


def test_get_module_not_found():
    resp = client.get("/api/modules/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


def test_review_card_not_found():
    resp = client.post("/api/review", json={
        "flashcard_id": "00000000-0000-0000-0000-000000000000",
        "quality": 3,
    })
    assert resp.status_code == 404


def test_get_modules_empty():
    resp = client.get("/api/modules")
    assert resp.status_code == 200
    assert resp.json() == []


def test_full_flow_mocked():
    extracted = _mock_extracted_content()
    ai_output = _mock_gemini_output()

    with patch("app.api.routes.extract_content", new_callable=AsyncMock, return_value=extracted), \
         patch("app.api.routes.get_learning_processor") as mock_get_proc:
        mock_processor = MagicMock()
        mock_processor.generate_learning_module = AsyncMock(return_value=ai_output)
        mock_get_proc.return_value = mock_processor

        # POST /api/generate
        resp = client.post("/api/generate", json={"url": "https://www.youtube.com/watch?v=test123test"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"] == ai_output.summary
        assert len(data["flashcards"]) == 5
        assert len(data["quiz_questions"]) == 3

        module_id = data["id"]

        # GET /api/modules/{module_id}
        resp = client.get(f"/api/modules/{module_id}")
        assert resp.status_code == 200
        mod = resp.json()
        assert mod["id"] == module_id
        assert len(mod["flashcards"]) == 5
        assert len(mod["quiz_questions"]) == 3

        # GET /api/modules/{module_id}/due-cards
        resp = client.get(f"/api/modules/{module_id}/due-cards")
        assert resp.status_code == 200
        due = resp.json()
        assert len(due) == 5

        # GET /api/modules/{module_id}/progress
        resp = client.get(f"/api/modules/{module_id}/progress")
        assert resp.status_code == 200
        progress = resp.json()
        assert progress["total_cards"] == 5
        assert progress["due_now"] == 5
        assert progress["mastered"] == 0
        assert progress["learning"] == 0

        # POST /api/review
        flashcard_id = data["flashcards"][0]["id"]
        resp = client.post("/api/review", json={
            "flashcard_id": flashcard_id,
            "quality": 5,
        })
        assert resp.status_code == 200
        review = resp.json()
        assert review["new_interval_days"] == 1
