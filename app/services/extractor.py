import asyncio
import io
import re
from dataclasses import dataclass, field
from urllib.parse import urlparse, parse_qs

import httpx
import trafilatura
from bs4 import BeautifulSoup
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound, RequestBlocked

from app.services.exceptions import ExtractionError, InvalidURLError, NoTranscriptError


@dataclass
class ExtractedContent:
    source_type: str  # "youtube", "article", "notes", "image", "pdf", "document"
    title: str
    text: str
    url: str
    images: list[bytes] = field(default_factory=list)
    original_filename: str = ""
    file_size: int = 0


_YOUTUBE_PATTERNS = [
    r"(?:https?://)?(?:www\.)?youtube\.com/watch\?",
    r"(?:https?://)?youtu\.be/",
    r"(?:https?://)?(?:www\.)?youtube\.com/embed/",
    r"(?:https?://)?(?:www\.)?youtube\.com/shorts/",
    r"(?:https?://)?m\.youtube\.com/watch\?",
]


def detect_source_type(url: str) -> str:
    if not url or not url.strip():
        raise InvalidURLError("URL cannot be empty")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise InvalidURLError(f"Invalid URL scheme: {url}")
    for pattern in _YOUTUBE_PATTERNS:
        if re.match(pattern, url):
            return "youtube"
    return "article"


def extract_video_id(url: str) -> str:
    parsed = urlparse(url)
    if parsed.hostname in ("youtu.be",):
        video_id = parsed.path.lstrip("/")
    elif "/embed/" in parsed.path:
        video_id = parsed.path.split("/embed/")[1].split("/")[0]
    elif "/shorts/" in parsed.path:
        video_id = parsed.path.split("/shorts/")[1].split("/")[0]
    else:
        qs = parse_qs(parsed.query)
        video_id = qs.get("v", [None])[0]
    if not video_id or len(video_id) < 11:
        raise InvalidURLError(f"Could not extract video ID from: {url}")
    return video_id[:11]


async def _fetch_youtube_title(video_id: str) -> str:
    fallback = f"YouTube Video {video_id}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"https://www.youtube.com/watch?v={video_id}")
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            title_tag = soup.find("title")
            if title_tag and title_tag.string:
                title = title_tag.string.replace(" - YouTube", "").strip()
                if title:
                    return title
    except Exception:
        pass
    return fallback


async def _fetch_youtube_thumbnail(video_id: str) -> bytes | None:
    """Download YouTube video thumbnail."""
    urls = [
        f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
        f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
    ]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            for thumb_url in urls:
                try:
                    resp = await client.get(thumb_url)
                    if resp.status_code == 200 and len(resp.content) > 1000:
                        return resp.content
                except Exception:
                    continue
    except Exception:
        pass
    return None


def _fetch_transcript(video_id: str) -> str:
    ytt_api = YouTubeTranscriptApi()
    transcript_list = ytt_api.list(video_id)
    transcript = None
    # Try manually created first
    try:
        transcript = transcript_list.find_manually_created_transcript(["en"])
    except Exception:
        try:
            manual = [t for t in transcript_list if not t.is_generated]
            if manual:
                transcript = manual[0]
        except Exception:
            pass
    # Fall back to auto-generated
    if transcript is None:
        try:
            transcript = transcript_list.find_generated_transcript(["en"])
        except Exception:
            generated = [t for t in transcript_list if t.is_generated]
            if generated:
                transcript = generated[0]
    if transcript is None:
        raise NoTranscriptError(f"No transcripts available for video: {video_id}")
    segments = transcript.fetch()
    text = " ".join(seg.text for seg in segments)
    return re.sub(r"\s+", " ", text).strip()


async def extract_youtube(url: str) -> ExtractedContent:
    video_id = extract_video_id(url)
    max_retries = 3
    last_error = None
    for attempt in range(max_retries):
        try:
            text = await asyncio.to_thread(_fetch_transcript, video_id)
            break
        except NoTranscriptError:
            raise
        except (TranscriptsDisabled, NoTranscriptFound) as e:
            raise NoTranscriptError(str(e))
        except RequestBlocked as e:
            last_error = e
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)
                continue
            raise ExtractionError(
                "YouTube is temporarily blocking requests. Please try again in a minute."
            )
        except Exception as e:
            raise ExtractionError(f"Failed to extract YouTube transcript: {e}")
    else:
        raise ExtractionError(f"Failed to extract YouTube transcript: {last_error}")

    title = await _fetch_youtube_title(video_id)
    thumbnail = await _fetch_youtube_thumbnail(video_id)
    images = [thumbnail] if thumbnail else []

    return ExtractedContent(
        source_type="youtube", title=title, text=text, url=url, images=images
    )


async def extract_article(url: str) -> ExtractedContent:
    title = ""
    text = ""
    html_content = ""

    # Primary: trafilatura
    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            html_content = downloaded
            text = trafilatura.extract(downloaded, include_comments=False, include_tables=True) or ""
            metadata = trafilatura.extract_metadata(downloaded)
            if metadata and metadata.title:
                title = metadata.title
    except Exception:
        pass

    # Fallback: httpx + BeautifulSoup
    if not text or len(text.strip()) < 100:
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                resp = await client.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                })
                resp.raise_for_status()
                html_content = resp.text
                soup = BeautifulSoup(html_content, "html.parser")
                if not title:
                    title_tag = soup.find("title")
                    if title_tag and title_tag.string:
                        title = title_tag.string.strip()
                for tag in soup.find_all(["script", "style", "nav", "footer", "header", "aside"]):
                    tag.decompose()
                text = soup.get_text(separator="\n", strip=True)
        except Exception as e:
            if not text:
                raise ExtractionError(f"Failed to extract article content: {e}")

    # Clean text
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    if not text or len(text) < 100:
        raise ExtractionError("Could not extract meaningful content from this URL")

    if not title:
        title = url

    # Extract article images
    images = await _extract_article_images(html_content, url)

    return ExtractedContent(
        source_type="article", title=title, text=text, url=url, images=images
    )


async def _extract_article_images(html: str, base_url: str) -> list[bytes]:
    """Download the first 5 meaningful images from article HTML."""
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    img_tags = soup.find_all("img", src=True)
    images = []

    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            for img_tag in img_tags:
                if len(images) >= 5:
                    break

                src = img_tag.get("src", "")
                if not src or src.startswith("data:"):
                    continue
                # Skip SVGs and icons
                if src.endswith(".svg") or "icon" in src.lower() or "logo" in src.lower():
                    continue

                # Resolve relative URLs
                if src.startswith("//"):
                    src = "https:" + src
                elif src.startswith("/"):
                    parsed = urlparse(base_url)
                    src = f"{parsed.scheme}://{parsed.netloc}{src}"
                elif not src.startswith("http"):
                    continue

                try:
                    resp = await client.get(src)
                    if resp.status_code == 200 and len(resp.content) > 5000:
                        content_type = resp.headers.get("content-type", "")
                        if "image" in content_type and "svg" not in content_type:
                            images.append(resp.content)
                except Exception:
                    continue
    except Exception:
        pass

    return images


def extract_from_notes(title: str, content: str) -> ExtractedContent:
    text = re.sub(r"\s+", " ", content).strip()
    if len(text) < 10:
        raise ExtractionError("Notes content is too short.")
    return ExtractedContent(source_type="notes", title=title, text=text, url="")


def extract_from_image(file_bytes: bytes, filename: str) -> ExtractedContent:
    """Vision-first: send raw image to Gemini instead of OCR."""
    from PIL import Image

    # Validate it's a real image
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.verify()
    except Exception:
        raise ExtractionError("Could not open this image file.")

    return ExtractedContent(
        source_type="image",
        title=filename,
        text="",  # Let Gemini Vision handle everything
        url="",
        images=[file_bytes],
    )


def extract_from_pdf(file_bytes: bytes, filename: str) -> ExtractedContent:
    """Hybrid: extract text + render pages as images for Gemini Vision."""
    import fitz

    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception:
        raise ExtractionError("Could not open this PDF file.")

    # Extract text
    pages_text = []
    for page in doc:
        pages_text.append(page.get_text())
    text = "\n".join(pages_text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    # Render pages as images
    images = []
    page_indices = list(range(len(doc)))
    if len(page_indices) > 20:
        step = len(page_indices) / 20
        page_indices = [int(i * step) for i in range(20)]

    for page_num in page_indices:
        page = doc[page_num]
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        buf = io.BytesIO()
        buf.write(pix.tobytes("png"))
        images.append(buf.getvalue())

    doc.close()

    title = filename.rsplit(".", 1)[0] if "." in filename else filename

    if not text and not images:
        raise ExtractionError("Could not extract content from this PDF.")

    return ExtractedContent(
        source_type="pdf", title=title, text=text, url="", images=images
    )


def extract_from_document(file_bytes: bytes, filename: str) -> ExtractedContent:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    title = filename.rsplit(".", 1)[0] if "." in filename else filename
    text = ""
    images: list[bytes] = []

    if ext == "docx":
        from docx import Document
        try:
            doc = Document(io.BytesIO(file_bytes))
            text = "\n".join(p.text for p in doc.paragraphs)

            # Extract embedded images from docx
            for rel in doc.part.rels.values():
                if "image" in rel.reltype:
                    try:
                        img_bytes = rel.target_part.blob
                        if len(img_bytes) > 500:
                            images.append(img_bytes)
                    except Exception:
                        continue
        except Exception:
            raise ExtractionError("Could not open this Word document.")
    elif ext in ("txt", "md", "rtf"):
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1")
    else:
        raise ExtractionError(f"Unsupported document format: .{ext}")

    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < 50 and not images:
        raise ExtractionError("Could not extract meaningful text from this document.")

    return ExtractedContent(
        source_type="document", title=title, text=text, url="", images=images
    )


async def extract_content(source_url: str) -> ExtractedContent:
    source_type = detect_source_type(source_url)
    if source_type == "youtube":
        return await extract_youtube(source_url)
    return await extract_article(source_url)
