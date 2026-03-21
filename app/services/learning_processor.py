import asyncio
import io
import json
import re

from PIL import Image
from google import genai
from google.genai import types

from app.prompts import (
    LEARNING_DESIGNER_SYSTEM_PROMPT,
    CONTENT_PROMPT_TEMPLATE,
    VISION_LEARNING_DESIGNER_PROMPT,
    VISION_PROMPT_TEMPLATE,
    HYBRID_PROMPT_TEMPLATE,
    TOPIC_SYSTEM_PROMPT,
    TOPIC_PROMPT_TEMPLATE,
    EXPLAIN_AGAIN_PROMPTS,
    get_generation_instruction,
    get_difficulty_instruction,
)
from app.schemas.schemas import GeminiOutput
from app.services.exceptions import ExtractionError, QuotaExhaustedError

_FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"]
_MAX_IMAGES = 20


class LearningProcessor:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)
        self.models = _FALLBACK_MODELS

    # ── Text-only generation ──────────────────────────────────────────

    async def generate_learning_module(
        self, text: str, source_title: str,
        generate_flashcards: bool = True, generate_quiz: bool = True,
    ) -> GeminiOutput:
        """Text-only generation (YouTube transcripts, typed notes, articles)."""
        if len(text) > 500_000:
            text = text[:500_000]

        instruction = get_generation_instruction(generate_flashcards, generate_quiz, content_length=len(text))
        prompt = CONTENT_PROMPT_TEMPLATE.format(title=source_title, content=text, generation_instruction=instruction)
        config = types.GenerateContentConfig(
            system_instruction=LEARNING_DESIGNER_SYSTEM_PROMPT,
            temperature=0.3,
            response_mime_type="application/json",
        )
        return await self._call_gemini(prompt, config)

    # ── Topic generation ─────────────────────────────────────────────

    async def generate_from_topic(
        self, topic: str, difficulty: str = "beginner",
        generate_flashcards: bool = True, generate_quiz: bool = True,
    ) -> GeminiOutput:
        """Generate a micro-lesson from a topic using AI knowledge."""
        difficulty_instruction = get_difficulty_instruction(difficulty)
        instruction = get_generation_instruction(generate_flashcards, generate_quiz, content_length=2000)
        prompt = TOPIC_PROMPT_TEMPLATE.format(
            topic=topic,
            difficulty_instruction=difficulty_instruction,
            generation_instruction=instruction,
        )
        config = types.GenerateContentConfig(
            system_instruction=TOPIC_SYSTEM_PROMPT,
            temperature=0.4,
            response_mime_type="application/json",
        )
        return await self._call_gemini(prompt, config)

    # ── Explain Again ──────────────────────────────────────────────

    async def explain_again(self, summary: str, mode: str) -> str:
        """Re-explain a lesson summary in a different way."""
        template = EXPLAIN_AGAIN_PROMPTS.get(mode)
        if not template:
            raise ValueError(f"Invalid explain mode: {mode}")
        prompt = template.format(summary=summary)
        return await self._call_gemini_text(prompt)

    async def _call_gemini_text(self, prompt: str) -> str:
        """Call Gemini and return plain text response."""
        last_error = None
        for model_name in self.models:
            try:
                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(temperature=0.5),
                )
                return response.text
            except Exception as e:
                last_error = e
                error_str = str(e).lower()
                if "quota" in error_str or "resource_exhausted" in error_str:
                    continue
                raise ExtractionError(f"Gemini API error: {e}")
        if last_error and ("quota" in str(last_error).lower()):
            raise QuotaExhaustedError("AI service is busy. Please wait a minute and try again.")
        raise ExtractionError(f"Failed to generate explanation. Last error: {last_error}")

    # ── Vision generation ─────────────────────────────────────────────

    async def generate_from_images(
        self,
        images: list[bytes],
        source_title: str,
        supplementary_text: str = "",
        generate_flashcards: bool = True,
        generate_quiz: bool = True,
    ) -> GeminiOutput:
        """Vision-based generation — send images directly to Gemini."""
        pil_images = self._prepare_images(images)

        sup = ""
        if supplementary_text:
            trimmed = supplementary_text[:100_000]
            sup = f"Additional text extracted from the source:\n{trimmed}"

        # For vision, estimate content size from supplementary text + image count
        est_length = len(supplementary_text) + len(images) * 1000
        instruction = get_generation_instruction(generate_flashcards, generate_quiz, content_length=est_length)
        text_prompt = VISION_PROMPT_TEMPLATE.format(
            title=source_title,
            supplementary_text=sup,
            generation_instruction=instruction,
        )

        contents: list = list(pil_images) + [text_prompt]
        config = types.GenerateContentConfig(
            system_instruction=VISION_LEARNING_DESIGNER_PROMPT,
            temperature=0.3,
            response_mime_type="application/json",
        )
        return await self._call_gemini(contents, config)

    # ── Hybrid generation ─────────────────────────────────────────────

    async def generate_hybrid(
        self,
        text: str,
        images: list[bytes],
        source_title: str,
        generate_flashcards: bool = True,
        generate_quiz: bool = True,
    ) -> GeminiOutput:
        """Send text AND images together for maximum context."""
        if len(text) > 500_000:
            text = text[:500_000]

        pil_images = self._prepare_images(images)

        instruction = get_generation_instruction(generate_flashcards, generate_quiz, content_length=len(text))
        text_prompt = HYBRID_PROMPT_TEMPLATE.format(
            title=source_title,
            content=text,
            generation_instruction=instruction,
        )

        contents: list = list(pil_images) + [text_prompt]
        config = types.GenerateContentConfig(
            system_instruction=LEARNING_DESIGNER_SYSTEM_PROMPT,
            temperature=0.3,
            response_mime_type="application/json",
        )
        return await self._call_gemini(contents, config)

    # ── Shared helpers ────────────────────────────────────────────────

    def _prepare_images(self, images: list[bytes]) -> list[Image.Image]:
        """Convert raw bytes to PIL Images, sample if too many."""
        if len(images) > _MAX_IMAGES:
            step = len(images) / _MAX_IMAGES
            indices = [int(i * step) for i in range(_MAX_IMAGES)]
            images = [images[i] for i in indices]

        pil_images = []
        for img_bytes in images:
            try:
                img = Image.open(io.BytesIO(img_bytes))
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGB")
                pil_images.append(img)
            except Exception:
                continue

        if not pil_images:
            raise ExtractionError("No valid images could be processed.")
        return pil_images

    async def _call_gemini(
        self,
        contents,
        config: types.GenerateContentConfig,
    ) -> GeminiOutput:
        """Call Gemini with model fallback and retry logic."""
        last_error = None
        for model_name in self.models:
            for attempt in range(3):
                try:
                    send_contents = contents
                    if attempt > 0 and isinstance(contents, str):
                        if isinstance(last_error, ValueError):
                            send_contents = (
                                "Your previous response was not valid JSON. "
                                "Please respond with ONLY valid JSON matching the schema.\n\n"
                                + contents
                            )
                        elif isinstance(last_error, Exception):
                            send_contents = (
                                f"Your previous response had validation errors: {last_error}. "
                                "Please fix these fields and respond with valid JSON.\n\n"
                                + contents
                            )

                    response = await asyncio.to_thread(
                        self.client.models.generate_content,
                        model=model_name,
                        contents=send_contents,
                        config=config,
                    )

                    data = self._parse_response(response.text)
                    return GeminiOutput(**data)

                except (ValueError, json.JSONDecodeError) as e:
                    last_error = e
                    continue
                except Exception as e:
                    last_error = e
                    error_str = str(e).lower()
                    if "quota" in error_str or "resource_exhausted" in error_str:
                        last_error = e
                        break  # try next model
                    if "rate" in error_str or "500" in error_str or "503" in error_str:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    if "validation" in error_str:
                        continue
                    raise ExtractionError(f"Gemini API error: {e}")

        if last_error and ("quota" in str(last_error).lower() or "resource_exhausted" in str(last_error).lower()):
            raise QuotaExhaustedError("AI service is busy. Please wait a minute and try again.")
        raise ExtractionError(
            f"Failed to generate learning module. Last error: {last_error}"
        )

    def _parse_response(self, response_text: str) -> dict:
        """Parse JSON from Gemini response, handling various formats."""
        # Try direct parse
        try:
            return json.loads(response_text)
        except (json.JSONDecodeError, TypeError):
            pass

        # Strip markdown code fences
        cleaned = re.sub(r"^```(?:json)?\s*\n?", "", response_text.strip())
        cleaned = re.sub(r"\n?```\s*$", "", cleaned)
        try:
            return json.loads(cleaned)
        except (json.JSONDecodeError, TypeError):
            pass

        # Try to find JSON by locating outermost { }
        start = response_text.find("{")
        end = response_text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(response_text[start : end + 1])
            except (json.JSONDecodeError, TypeError):
                pass

        raise ValueError(f"Could not parse JSON from response: {response_text[:200]}")
