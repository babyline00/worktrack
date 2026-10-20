# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **PostgreSQL Database** - Set up a PostgreSQL database (Vercel Postgres, Neon, Supabase, Railway, etc.)
3. **Git Repository** - Push code to GitHub/GitLab/Bitbucket

## Quick Deploy

### 1. Push to Git Repository
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### 2. Import Project in Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your Git repository
4. Configure environment variables (see below)
5. Click "Deploy"

## Required Environment Variables

Set these in Vercel Project Settings → Environment Variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string (e.g., `postgresql://user:pass@host:5432/db?sslmode=require`) | ✅ Yes |
| `NEXTAUTH_URL` | Your production URL (e.g., `https://your-app.vercel.app`) | ✅ Yes |
| `NEXTAUTH_SECRET` | Random string, min 32 chars (generate with `openssl rand -base64 32`) | ✅ Yes |

### Optional Environment Variables
| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | SMTP server for email notifications |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `EMAIL_FROM` | Sender email address |
| `GOOGLE_MAPS_API_KEY` | For map features |

## Database Setup

### Option 1: Vercel Postgres (Recommended)
1. In Vercel Dashboard, go to Storage → Create Database → Postgres
2. Copy the connection string
2. Add as `DATABASE_URL` in environment variables

### Option 2: Neon (Free Tier Available)
1. Create account at [neon.tech](https://neon.tech)
2. Create project → Copy connection string
3. Add as `DATABASE_URL`

### Option 3: Supabase (Free Tier Available)
1. Create account at [supabase.com](https://supabase.com)
2. Create project → Settings → Database → Connection string
3. Add as `DATABASE_URL`

### Option 4: Railway / Render / PlanetScale
Similar process - create database, get connection string, add as `DATABASE_URL`

## Post-Deployment

### 1. Run Database Migrations
After first deploy, run migrations:
```bash
# In Vercel CLI or local with production DATABASE_URL
npx prisma migrate deploy
```

### 2. Seed Initial Data (Optional)
```bash
npx prisma db seed
```

## Real-time Server (WebSocket)

The real-time server (Socket.io on port 3003) **cannot run on Vercel** as it requires a persistent WebSocket server.

### Options:
1. **Deploy separately** to Railway, Fly.io, Render, or similar
2. **Use managed service** like Pusher, Ably, or Socket.io Cloud
3. **Fallback to polling** - The app gracefully degrades to polling if WebSocket unavailable

### Deploy Real-time Server to Railway (Example)
```bash
# In mini-services/worktrack-realtime/
railway login
railway init
railway up
```

## Build Configuration

The `vercel.json` is configured for Next.js:
```json
{
  "buildCommand": "prisma generate && next build",
  "installCommand": "bun install",
  "framework": "nextjs"
}
```

## Troubleshooting

### Build Fails: Prisma Client Not Generated
- Ensure `DATABASE_URL` is set in Vercel environment variables
- Run `prisma generate` locally to verify schema

### Database Connection Fails
- Verify `DATABASE_URL` format: `postgresql://user:pass@host:5432/db?sslmode=require`
- Check database allows connections from Vercel IPs (0.0.0.0/0 for Neon/Supabase)
- Ensure `sslmode=require` in connection string

### Authentication Issues
- Verify `NEXTAUTH_URL` matches your deployment URL exactly
- Check `NEXTAUTH_SECRET` is set and consistent

### Prisma Errors
- Run `npx prisma generate` locally with production `DATABASE_URL`
- Check Prisma schema compatibility with PostgreSQL

## Mobile App (Flutter)

The Flutter app is separate and builds to APK. For production:
1. Update `API_BASE_URL` in build command to your production URL
2. Build release APK: `flutter build apk --release --dart-define=API_BASE_URL=https://your-app.vercel.app/api/v1`
3. Distribute via Play Store, TestFlight, or direct APK distribution

## Monitoring

- Check Vercel Analytics for performance
- Check Vercel Functions for API errors
- Check Database logs for slow queries

## Security Checklist

- [ ] `NEXTAUTH_SECRET` is strong (32+ chars)
- [ ] `DATABASE_URL` uses SSL (`sslmode=require`)
- [ ] Database user has minimal required permissions
- [ ] CORS origins restricted in production
- [ ] Rate limiting on API endpoints
- [ ] HTTPS enforced (automatic on Vercel)

## Rollback

If deployment has issues:
1. Go to Vercel Dashboard → Deployments
2. Click "..." on previous working deployment → "Promote to Production"