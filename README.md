# Veracast 🔗

**Post it. Prove it. Spread it.** 

A social media platform for news and current events where every factual claim must be backed by a verifiable source — enforced at post time, with real keyword matching between your post and the source URL.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (Postgres) |
| Auth | JWT (httpOnly cookie + localStorage) |
| Styling | Tailwind CSS |
| Hosting | Vercel |

---

## Local Setup (Step by Step)

### 1. Prerequisites

Install these if you don't have them:

- **Node.js 20+** → https://nodejs.org (download the LTS version)
- **Git** → https://git-scm.com
- A free **Supabase** account → https://supabase.com
- A free **Vercel** account → https://vercel.com

---

### 2. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/veracast.git
cd veracast
```

---

### 3. Install dependencies

```bash
npm install
```

---

### 4. Set up Supabase

1. Go to https://supabase.com and click **New project**
2. Give it a name (e.g. `veracast`), set a database password, pick a region close to you
3. Wait ~2 minutes for it to spin up
4. Go to **SQL Editor** → **New query**
5. Open the file `supabase-schema.sql` from this repo, copy the entire contents, paste into the editor, and click **Run**
6. You should see "Success. No rows returned"

Now get your API keys:
1. In your Supabase project, go to **Settings** → **API**
2. Copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)
   - **service_role** key (another long string — keep this secret!)

---

### 5. Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` in any text editor and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=run-the-command-below-to-generate-this
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

To generate a secure JWT secret, run this in your terminal:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and paste it as your `JWT_SECRET`.

---

### 6. Run locally

```bash
npm run dev
```

Open http://localhost:3000 — you should see Veracast running.

Try:
- Creating an account
- Writing a post with a factual claim (e.g. mention "highway" or "inflation")
- Pasting a real URL as a source — it will fetch the page and check keywords
- Following other users

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/veracast.git
git push -u origin main
```

### 2. Connect to Vercel

1. Go to https://vercel.com/new
2. Click **Import Git Repository** and select your `veracast` repo
3. Vercel will auto-detect it's a Next.js project
4. **Before deploying**, click **Environment Variables** and add all 5 variables from your `.env.local`:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `JWT_SECRET` | Your generated secret |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` (update after first deploy) |

5. Click **Deploy**

Your site will be live at `https://veracast.vercel.app` (or similar) in ~2 minutes.

### 3. Update APP_URL

After your first deploy, go to Vercel → your project → **Settings** → **Environment Variables**, update `NEXT_PUBLIC_APP_URL` to your actual Vercel URL, then redeploy.

---

## Project Structure

```
veracast/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts       # POST — log in, returns JWT
│   │   │   │   ├── register/route.ts    # POST — create account
│   │   │   │   └── me/route.ts          # GET — current user | DELETE — logout
│   │   │   ├── posts/
│   │   │   │   ├── route.ts             # GET feed, POST create post
│   │   │   │   └── [id]/action/route.ts # POST — like / bookmark
│   │   │   ├── users/
│   │   │   │   ├── route.ts             # GET — list users (explore)
│   │   │   │   └── [handle]/route.ts    # GET — user profile + posts
│   │   │   ├── follow/route.ts          # POST — toggle follow
│   │   │   └── source-verify/route.ts  # POST — verify source URL
│   │   ├── layout.tsx                   # Root layout + fonts
│   │   ├── page.tsx                     # Entry point
│   │   └── globals.css                  # Tailwind + design tokens
│   ├── components/
│   │   ├── AppShell.tsx                 # Main layout, all views, navigation
│   │   ├── PostCard.tsx                 # Individual post display
│   │   ├── Compose.tsx                  # Post composer with source verification
│   │   └── AuthModal.tsx                # Login / register modal
│   ├── hooks/
│   │   └── useAuth.tsx                  # Auth context + hook
│   ├── lib/
│   │   ├── supabase.ts                  # Supabase clients
│   │   ├── auth.ts                      # JWT sign/verify helpers
│   │   ├── sourceVerify.ts              # Source URL fetching + keyword matching
│   │   └── api.ts                       # Fetch wrapper
│   └── types/
│       └── index.ts                     # TypeScript types
├── supabase-schema.sql                  # Run this in Supabase SQL Editor
├── .env.local.example                   # Copy to .env.local and fill in
├── tailwind.config.ts
├── next.config.js
└── package.json
```

---

## How Source Verification Works

When a user pastes a source URL for a post containing a factual claim:

1. The frontend sends `{ url, postText }` to `/api/source-verify`
2. The server fetches the URL with a 8-second timeout
3. It strips HTML (scripts, styles, nav, footer) and extracts the page's main text
4. It extracts meaningful keywords from both the post and the page (removing stopwords)
5. It checks how many of the post's top 15 keywords appear in the page text
6. Score: `(matched / total) * 100`, +15 bonus for trusted domains (Reuters, BBC, NOS, etc.)
7. Returns: `match` (≥50%), `partial` (≥22%), or `mismatch` (<22%)

This means a post about "A16 highway closure this weekend" requires a source that actually mentions highways and closures — not a random Wikipedia link.

---

## Features

- **Real authentication** — register, login, JWT sessions
- **Source verification** — server-side URL fetch + keyword matching
- **Full social graph** — follow/unfollow users
- **Feed views** — Home, Following, Trending
- **Profile pages** — posts, sourced only, liked tabs + source rate bar
- **Explore** — discover and follow users
- **Likes & bookmarks** — persisted in database
- **Post categories** — News, Science, Opinion, Meme, Lifestyle
- **Exempt posts** — Opinion/Meme/Lifestyle skip source requirement
- **Mobile responsive** — bottom nav on mobile, sidebar on desktop

---

## Troubleshooting

**"Invalid API key" from Supabase**
→ Double-check your `.env.local` — make sure there are no extra spaces or quotes around the values.

**Source verification returns "error"**
→ Some websites block bots. This is expected. Try a direct article URL from a major news site.

**"Email or handle already taken" on register**
→ That email/handle is already in your Supabase database. Try a different one or check the Supabase dashboard under Table Editor → users.

**Build fails on Vercel**
→ Make sure all 5 environment variables are added in the Vercel dashboard before deploying.

**Posts not loading**
→ Open the browser console. If you see a Supabase error, the schema may not have been applied — re-run `supabase-schema.sql`.

---

## License

MIT — build on it, fork it, make it yours.
