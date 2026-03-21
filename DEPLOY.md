# Deployment Guide

## Backend (Railway.app — free tier available)

1. Go to https://railway.app and sign up with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select the micro-learn repository
4. Set Root Directory to / (project root, not frontend)
5. Add environment variables in Railway dashboard:
   - DATABASE_URL = your Supabase connection string
   - GEMINI_API_KEY = your Gemini API key
   - SECRET_KEY = your secret key
6. Railway will auto-detect Python and deploy
7. Copy the public URL (like https://micro-learn-production.up.railway.app)

## Frontend (Vercel — free tier)

1. Go to https://vercel.com and sign up with GitHub
2. Click "Import Project" → select micro-learn repo
3. Set Root Directory to "frontend"
4. Set Framework Preset to "Next.js"
5. Add environment variables:
   - NEXT_PUBLIC_API_URL = your Railway backend URL from step 7 above
   - NEXTAUTH_URL = your Vercel URL (like https://micro-learn.vercel.app)
   - NEXTAUTH_SECRET = same secret key
   - GOOGLE_CLIENT_ID = your Google OAuth client ID
   - GOOGLE_CLIENT_SECRET = your Google OAuth secret
6. Deploy

## After Deploy

1. Update Google OAuth credentials:
   - Add your Vercel URL to authorized origins
   - Add https://your-app.vercel.app/api/auth/callback/google to redirect URIs

2. Test the full flow:
   - Sign up with email
   - Generate a module from notes
   - Review flashcards
   - Check progress

## Costs (Free Tier Limits)

- Railway: free tier gives $5/month credit, enough for light usage
- Vercel: free tier gives 100GB bandwidth, unlimited deploys
- Supabase: free tier gives 500MB database, 50K monthly active users
- Gemini API: free tier gives 60 requests/minute, 1500 requests/day
- Total cost for light usage: $0/month
