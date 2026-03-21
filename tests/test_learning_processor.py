import json
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from app.schemas.schemas import GeminiOutput
from app.services.learning_processor import LearningProcessor


def _valid_output():
    return {
        "summary": "This is a test summary of the content.",
        "flashcards": [
            {"front": f"Question {i}?", "back": f"Answer {i}."} for i in range(5)
        ],
        "quiz": [
            {
                "question": f"Quiz question {i}?",
                "options": ["A", "B", "C", "D"],
                "option_feedbacks": ["Feedback A", "Feedback B", "Feedback C", "Feedback D"],
                "correct_answer": i % 4,
                "explanation": f"Explanation {i}.",
            }
            for i in range(3)
        ],
    }


@pytest.fixture
def processor():
    with patch("app.services.learning_processor.genai"):
        return LearningProcessor(api_key="test-key")


# --- Parse Response Tests ---

def test_parse_response_valid_json(processor):
    data = _valid_output()
    result = processor._parse_response(json.dumps(data))
    assert "summary" in result
    assert "flashcards" in result
    assert "quiz" in result


def test_parse_response_with_code_fences(processor):
    data = _valid_output()
    wrapped = f"```json\n{json.dumps(data)}\n```"
    result = processor._parse_response(wrapped)
    assert "summary" in result
    assert "flashcards" in result
    assert "quiz" in result


def test_parse_response_invalid(processor):
    with pytest.raises(ValueError):
        processor._parse_response("This is not JSON")


# --- Pydantic Validation Tests ---

def test_pydantic_validation_valid():
    data = _valid_output()
    output = GeminiOutput(**data)
    assert output.summary == data["summary"]
    assert len(output.flashcards) == 5
    assert len(output.quiz) == 3


def test_pydantic_validation_few_flashcards_allowed():
    """Flashcards list can be empty or have few items (generation options may skip them)."""
    data = _valid_output()
    data["flashcards"] = [{"front": "Q?", "back": "A."}, {"front": "Q2?", "back": "A2."}]
    output = GeminiOutput(**data)
    assert len(output.flashcards) == 2


def test_pydantic_validation_wrong_option_count():
    data = _valid_output()
    data["quiz"][0]["options"] = ["A", "B"]
    with pytest.raises(ValidationError):
        GeminiOutput(**data)


# --- Generate Module Tests ---

@pytest.mark.asyncio
async def test_generate_module_success():
    valid_json = json.dumps(_valid_output())

    mock_response = MagicMock()
    mock_response.text = valid_json

    with patch("app.services.learning_processor.genai") as mock_genai, \
         patch("asyncio.to_thread", return_value=mock_response):
        processor = LearningProcessor(api_key="test-key")

        result = await processor.generate_learning_module("Some text content", "Test Title")

    assert isinstance(result, GeminiOutput)
    assert len(result.flashcards) == 5
    assert len(result.quiz) == 3


@pytest.mark.asyncio
async def test_generate_module_retry_on_bad_json():
    valid_json = json.dumps(_valid_output())

    bad_response = MagicMock()
    bad_response.text = "This is not valid JSON at all"

    good_response = MagicMock()
    good_response.text = valid_json

    with patch("app.services.learning_processor.genai") as mock_genai, \
         patch("asyncio.to_thread", side_effect=[bad_response, good_response]):
        processor = LearningProcessor(api_key="test-key")

        result = await processor.generate_learning_module("Some text content", "Test Title")

    assert isinstance(result, GeminiOutput)
