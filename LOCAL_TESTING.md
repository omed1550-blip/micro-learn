# Local Testing Guide

## Prerequisites
- Python 3.11+
- Node.js 18+
- Your .env file in the project root with DATABASE_URL and GEMINI_API_KEY filled in

## Step 1: Start the Backend

Open a terminal and run:

```bash
cd micro-learn
pip install -r requirements.txt   # or: uv sync
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
- "Uvicorn running on http://0.0.0.0:8000"
- Open http://localhost:8000/health in your browser — should show `{"status": "healthy"}`
- Open http://localhost:8000/docs — should show the FastAPI Swagger UI with all endpoints

## Step 2: Start the Frontend

Open a SECOND terminal and run:

```bash
cd micro-learn/frontend
npm install
npm run dev
```

You should see:
- "ready started server on http://localhost:3000"
- Open http://localhost:3000 in your browser

## Step 3: Test the Full Flow

1. Open http://localhost:3000
2. Paste a YouTube URL (pick a short video with captions, e.g. a TED-Ed video)
3. Click Generate
4. Watch the processing animation
5. You should land on the learning page with:
   - A summary of the video
   - 8-15 flashcards
   - 5-8 quiz questions
6. Test flipping flashcards and rating them
7. Test the quiz
8. Check the progress tab
9. Try the share snapshot

## Troubleshooting

### Backend won't start
- Check .env has correct DATABASE_URL and GEMINI_API_KEY
- Make sure all Python dependencies are installed
- Try: `python -c "from app.main import app; print('OK')"`

### Database connection fails
- Check your Supabase project is not paused (free tier pauses after inactivity)
- Go to Supabase dashboard and click "Restore" if paused
- Verify the password in DATABASE_URL is correct and special characters are URL-encoded

### Frontend shows network errors
- Make sure backend is running on port 8000
- Check frontend/.env.local has `NEXT_PUBLIC_API_URL=http://localhost:8000`
- Check browser console for CORS errors

### Gemini API errors
- Verify your API key at https://aistudio.google.com/apikey
- Free tier: 60 requests/minute limit
- If you get 429 errors, wait a minute and retry

### No transcript found
- The YouTube video must have captions (auto-generated or manual)
- Try a popular video — they almost always have captions
- Shorts and very new videos might not have transcripts yet

## Test URLs to Try
- TED-Ed (short, always has captions): https://www.youtube.com/watch?v=RcYjXbSJBN8
- Any Wikipedia article URL for article extraction
