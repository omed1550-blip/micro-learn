from dataclasses import dataclass
from unittest.mock import MagicMock, patch, AsyncMock

import pytest
import pytest_asyncio

from app.services.extractor import (
    detect_source_type,
    extract_video_id,
    extract_youtube,
    extract_article,
)
from app.services.exceptions import (
    InvalidURLError,
    NoTranscriptError,
    ExtractionError,
)


# --- URL Detection Tests ---

def test_detect_youtube_standard():
    assert detect_source_type("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "youtube"


def test_detect_youtube_short():
    assert detect_source_type("https://youtu.be/dQw4w9WgXcQ") == "youtube"


def test_detect_youtube_embed():
    assert detect_source_type("https://www.youtube.com/embed/dQw4w9WgXcQ") == "youtube"


def test_detect_youtube_shorts():
    assert detect_source_type("https://www.youtube.com/shorts/dQw4w9WgXcQ") == "youtube"


def test_detect_youtube_mobile():
    assert detect_source_type("https://m.youtube.com/watch?v=dQw4w9WgXcQ") == "youtube"


def test_detect_article():
    assert detect_source_type("https://example.com/some-article") == "article"


def test_detect_invalid_empty():
    with pytest.raises(InvalidURLError):
        detect_source_type("")


def test_detect_invalid_no_scheme():
    with pytest.raises(InvalidURLError):
        detect_source_type("not-a-url")


# --- Video ID Extraction Tests ---

def test_extract_id_standard():
    assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"


def test_extract_id_short():
    assert extract_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"


def test_extract_id_with_extra_params():
    assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120") == "dQw4w9WgXcQ"


# --- YouTube Extractor Tests ---

@dataclass
class FakeSnippet:
    text: str
    start: float = 0.0
    duration: float = 1.0


class FakeTranscript:
    def __init__(self, is_generated=False, segments=None):
        self.is_generated = is_generated
        self._segments = segments or []

    def fetch(self):
        return self._segments


class FakeTranscriptList:
    def __init__(self, transcripts=None):
        self._transcripts = transcripts or []

    def __iter__(self):
        return iter(self._transcripts)

    def find_manually_created_transcript(self, languages):
        for t in self._transcripts:
            if not t.is_generated:
                return t
        raise Exception("No manual transcript")

    def find_generated_transcript(self, languages):
        for t in self._transcripts:
            if t.is_generated:
                return t
        raise Exception("No generated transcript")


@pytest.mark.asyncio
async def test_youtube_success():
    segments = [FakeSnippet(text="Hello"), FakeSnippet(text="world")]
    transcript = FakeTranscript(is_generated=False, segments=segments)
    transcript_list = FakeTranscriptList([transcript])

    mock_api = MagicMock()
    mock_api.list.return_value = transcript_list

    with patch("app.services.extractor.YouTubeTranscriptApi", return_value=mock_api), \
         patch("app.services.extractor._fetch_youtube_title", new_callable=AsyncMock, return_value="Test Video"):
        result = await extract_youtube("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    assert result.source_type == "youtube"
    assert result.text == "Hello world"
    assert result.title == "Test Video"
    assert "dQw4w9WgXcQ" in result.url


@pytest.mark.asyncio
async def test_youtube_no_transcript():
    from youtube_transcript_api._errors import TranscriptsDisabled

    mock_api = MagicMock()
    mock_api.list.side_effect = TranscriptsDisabled("abc")

    with patch("app.services.extractor.YouTubeTranscriptApi", return_value=mock_api):
        with pytest.raises(NoTranscriptError):
            await extract_youtube("https://www.youtube.com/watch?v=dQw4w9WgXcQ")


@pytest.mark.asyncio
async def test_youtube_no_captions():
    from youtube_transcript_api._errors import NoTranscriptFound

    mock_api = MagicMock()
    mock_api.list.side_effect = NoTranscriptFound("abc", ["en"], [])

    with patch("app.services.extractor.YouTubeTranscriptApi", return_value=mock_api):
        with pytest.raises(NoTranscriptError):
            await extract_youtube("https://www.youtube.com/watch?v=dQw4w9WgXcQ")


# --- Article Extractor Tests ---

@pytest.mark.asyncio
async def test_article_trafilatura_success():
    long_text = "This is a well-extracted article. " * 20

    with patch("app.services.extractor.trafilatura") as mock_traf:
        mock_traf.fetch_url.return_value = "<html>content</html>"
        mock_traf.extract.return_value = long_text
        mock_metadata = MagicMock()
        mock_metadata.title = "Great Article"
        mock_traf.extract_metadata.return_value = mock_metadata

        result = await extract_article("https://example.com/article")

    assert result.source_type == "article"
    assert result.title == "Great Article"
    assert len(result.text) >= 100


@pytest.mark.asyncio
async def test_article_fallback_to_bs4():
    html_content = "<html><head><title>Fallback Title</title></head><body>" + "<p>Some content here. </p>" * 20 + "</body></html>"

    with patch("app.services.extractor.trafilatura") as mock_traf, \
         patch("app.services.extractor.httpx.AsyncClient") as mock_client_cls:
        mock_traf.fetch_url.return_value = None
        mock_traf.extract.return_value = None

        mock_resp = MagicMock()
        mock_resp.text = html_content
        mock_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_cls.return_value = mock_client

        result = await extract_article("https://example.com/article")

    assert result.source_type == "article"
    assert result.title == "Fallback Title"
    assert len(result.text) >= 100


@pytest.mark.asyncio
async def test_article_too_short():
    with patch("app.services.extractor.trafilatura") as mock_traf, \
         patch("app.services.extractor.httpx.AsyncClient") as mock_client_cls:
        mock_traf.fetch_url.return_value = "<html>x</html>"
        mock_traf.extract.return_value = "Short"

        mock_resp = MagicMock()
        mock_resp.text = "<html><body>Short</body></html>"
        mock_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_cls.return_value = mock_client

        with pytest.raises(ExtractionError, match="Could not extract meaningful content"):
            await extract_article("https://example.com/article")
