import asyncio
from app.services.extractor import extract_content

async def test():
    urls = [
        "https://www.youtube.com/watch?v=RcYjXbSJBN8",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ]
    for url in urls:
        print(f"\nTesting: {url}")
        try:
            result = await extract_content(url)
            print(f"SUCCESS: type={result.source_type}, title={result.title}, text_length={len(result.text)}")
        except Exception as e:
            print(f"FAILED: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

asyncio.run(test())
