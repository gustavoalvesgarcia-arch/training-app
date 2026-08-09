# Training Log — Setup Guide

This is a real web app (not a Claude artifact) with your full training history, built to be installed on your iPhone home screen. Follow these steps in order.

## 1. Create the Supabase tables

In your Supabase project dashboard, go to the **SQL Editor** and run:

```sql
create table recovery_data (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  payload jsonb not null,
  updated_at timestamptz default now()
);

create table training_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  payload jsonb not null,
  updated_at timestamptz default now()
);

-- Allow the app to read/write (single-user app, no real auth layer)
alter table recovery_data enable row level security;
alter table training_logs enable row level security;

create policy "allow all" on recovery_data for all using (true) with check (true);
create policy "allow all" on training_logs for all using (true) with check (true);
```

**Note on security:** these policies allow anyone with your Supabase anon key to read/write this table. That's fine for a personal single-user app where the key isn't published anywhere public, but don't share the repo publicly with the key committed, and don't reuse this pattern for anything with real user accounts.

## 2. Get your Supabase credentials

In Supabase: Settings → API. Copy the **Project URL** and the **anon public** key.

## 3. Set up local environment

```bash
cp .env.example .env.local
```

Paste your Project URL and anon key into `.env.local`.

## 4. Install and seed the database

```bash
npm install
node scripts/seed.js
```

This pushes your full training history (Jan–Aug 2026 recovery data, body composition log) into Supabase, once. Run it only once — running it again just overwrites with the same seed data.

## 5. Test locally

```bash
npm run dev
```

Open the printed localhost URL. You should see your real data — recovery scores, workouts, body composition trends.

## 6. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```

Create a new empty repo on github.com, then:

```bash
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

## 7. Deploy on Vercel

- Go to vercel.com → **Add New Project** → import the GitHub repo you just pushed
- Vercel auto-detects it's a Vite project — leave build settings as default
- Before deploying, add environment variables (Project Settings → Environment Variables):
  - `VITE_SUPABASE_URL` = your Project URL
  - `VITE_SUPABASE_ANON_KEY` = your anon key
- Deploy

You'll get a real URL like `gustavo-training-xyz.vercel.app`.

## 8. Install on iPhone

Open that URL in **Safari** on your iPhone (must be Safari, not Chrome — Add to Home Screen only works from Safari on iOS). Tap the Share icon → **Add to Home Screen**. It'll appear as a full-screen app icon, no browser bar, launches like a native app.

## Ongoing use

Any changes you make in the app (logging a run, a recovery entry, a body-comp reading) save straight to Supabase and sync across any device you open the same URL on. To update the app itself later, push new commits to GitHub — Vercel redeploys automatically.
