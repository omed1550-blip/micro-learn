from app.services.extractor import extract_from_notes, extract_from_image, extract_from_pdf, extract_from_document

def test_notes():
    print("\n=== Test Notes ===")
    result = extract_from_notes("My Study Notes", "Spaced repetition is a learning technique. " * 5)
    print(f"SUCCESS: type={result.source_type}, title={result.title}, len={len(result.text)}")

def test_image():
    print("\n=== Test Image (OCR) ===")
    from PIL import Image, ImageDraw, ImageFont
    import io
    img = Image.new("RGB", (400, 100), "white")
    draw = ImageDraw.Draw(img)
    draw.text((10, 30), "Spaced repetition helps memory retention significantly", fill="black")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    result = extract_from_image(buf.getvalue(), "test_image.png")
    print(f"SUCCESS: type={result.source_type}, title={result.title}, len={len(result.text)}")
    print(f"  OCR text: {result.text[:100]}")

def test_pdf():
    print("\n=== Test PDF ===")
    import fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Spaced repetition is a learning technique where you review information at increasing intervals. " * 3)
    pdf_bytes = doc.tobytes()
    doc.close()
    result = extract_from_pdf(pdf_bytes, "test_document.pdf")
    print(f"SUCCESS: type={result.source_type}, title={result.title}, len={len(result.text)}")

def test_document():
    print("\n=== Test TXT Document ===")
    content = "The SM-2 algorithm calculates optimal review times using an Easiness Factor. " * 5
    result = extract_from_document(content.encode("utf-8"), "notes.txt")
    print(f"SUCCESS: type={result.source_type}, title={result.title}, len={len(result.text)}")

if __name__ == "__main__":
    test_notes()
    test_image()
    test_pdf()
    test_document()
    print("\nAll new source tests passed!")
