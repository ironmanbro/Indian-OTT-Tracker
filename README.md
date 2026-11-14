# CineTerminal IN — Indian OTT Tracker

Track the movies you've watched, see what your **Indian streaming subscriptions already include** (or what's free), and discover your next watch. Dark "trading-terminal" UI with a swipe onboarding, IMDb ratings, and an interactive D3 constellation graph.

**Features**
- Swipe onboarding: pick your OTT services (Netflix, Amazon Prime Video, JioHotstar, Zee5, SonyLIV, JioCinema), then a 25-card, genre-diverse deck — `❌ Haven't Seen` / `⭐ Watched` + 1–5★ rating.
- Dashboard HUD: movies watched, cumulative watch time (e.g. `142h 30m`), average rating, a ticker.
- Smart filters: **Included in My Subs**, **Free to Watch in India**, **IMDb 8.0+**, search, genre.
- Cards with IMDb badge and status tags: `[✓ Stream on Netflix]`, `[Watch FREE on YouTube]`, `[🔒 Requires …]`.
- Constellation graph: star size by IMDb + your rating, glow for 4–5★, links for shared genres / same director, detail drawer with streaming pathways.
- "Pick my next movie" recommender (genres, time available, taste learned from your ratings, IMDb quality).
- Profile is saved in the browser (`localStorage`) — no accounts, no backend state.

## Stack
React 18 · Vite · Tailwind CSS 3 · Framer Motion · D3 · Cloudflare Workers (static assets + one API route)

## Run locally
```bash
npm install
npm run dev            # http://localhost:5173 — runs on built-in demo data
```
To also test the live-data function locally:
```bash
cp .dev.vars.example .dev.vars     # put your TMDB key in .dev.vars (gitignored)
npm run cf:dev                     # wrangler dev — static site + /api/movies on http://localhost:8787
```

## Data: three layers (the app tries them in order)
1. **`/api/movies`** — handled by the Worker (`worker/index.js`). Live top-24 India catalog from TMDB, cached 24h at the edge. Needs the `TMDB_API_KEY` secret.
2. **`/india_movies.json`** — static file in `public/`, produced by the sync script (up to 1,000 movies **with IMDb ratings**).
3. **Built-in demo catalog** (25 movies, `src/App.jsx`) — always works. Its availability is illustrative and its IMDb ratings are approximate samples.

### Generate the full dataset with IMDb ratings
```bash
pip install -r scripts/requirements.txt
export TMDB_API_KEY=your_key          # free key from themoviedb.org (v3 key or v4 read token)
python3 scripts/sync_india_movies.py  # → public/india_movies.json  (≈2–3 min for 1,000 movies)
git add public/india_movies.json && git commit -m "Refresh data" && git push
```
What it does: downloads TMDB's daily ID export → top 1,000 by popularity → TMDB details + India watch-providers + director → keeps only titles streaming in India → joins IMDb ratings (`title.ratings.tsv.gz`) → writes the JSON. Resumable (cache in `scripts/.cache/`). Use `--top 200` for a quick run, `--no-imdb` to skip ratings.

> Ratings/director/providers only exist in the live catalog after the sync has run.

### Automatic daily refresh (GitHub Action)
`.github/workflows/sync-data.yml` runs the sync every day at 02:17 UTC and commits `public/india_movies.json` when the data changed; Cloudflare then redeploys from that commit.
1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret** → name `TMDB_API_KEY` (this is separate from the Cloudflare secret).
2. **Actions** tab → *Refresh data* → **Run workflow** to run it once now.

Safeguards: the run fails (and commits nothing) if fewer than 50 movies come back or fewer than 30% have IMDb ratings. If the repo is quiet for 60 days GitHub pauses scheduled workflows — the daily data commits keep it active.

## Deploy to Cloudflare (Workers + static assets)
1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → pick this repo.
2. Settings (defaults work):
   - **Build command:** leave empty — `wrangler deploy` runs `npm run build` itself (see `[build]` in `wrangler.toml`)
   - **Deploy command:** `npx wrangler deploy`
   - **Node:** taken from `.node-version` (22) — wrangler 4 needs Node ≥ 22.12, so don't override it with an older `NODE_VERSION`
   - The project name in Cloudflare must match `name` in `wrangler.toml` (`indian-ott-tracker`) — change one to match the other if they differ.
3. **Settings → Variables and Secrets** → add secret **`TMDB_API_KEY`**. Optional — without it the site uses `/india_movies.json` or the demo data.
4. Push to `main` → Cloudflare builds and deploys.

CLI alternative: `npx wrangler login && npm run cf:deploy`.

**Cloudflare Pages instead?** `wrangler pages deploy` publishes the static site only (the Worker's `/api/movies` route isn't included, so the app uses `/india_movies.json`, then the bundled mock data):
```bash
npx wrangler login
npm run deploy:pages      # = npm run build && wrangler pages deploy dist --project-name indian-ott-tracker
```
For Git-connected Pages: build command `npm run build`, output directory `dist`, Node 22.

**First-time git setup** (from scratch):
```bash
git init -b main && git add -A && git commit -m "Initial commit"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## Legal / attribution (read before going public or commercial)
- **TMDB**: free API tier is for **non-commercial** use; commercial use needs a written agreement with TMDB. Credit TMDB and **JustWatch** (watch-provider data). The app footer already includes the required notice: *"This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data provided by JustWatch."*
- **IMDb**: ratings come from IMDb's free *non-commercial* datasets — personal/non-commercial use only; check their current terms and attribution wording.
- Provider deep-links in the detail drawer are **search links** (e.g. `netflix.com/search?q=…`), not direct title pages; the URL patterns are best-effort and unverified.

## Project layout
```
src/
├─ main.jsx · index.css
├─ App.jsx                     root: catalog + saved profile + stage machine (loading → subs → swipe → dash)
├─ components/
│  ├─ SubsStep.jsx             onboarding step 1: subscription matrix
│  ├─ OnboardingDeck.jsx       onboarding step 2: 25-card swipe deck + star-rating modal
│  ├─ Dashboard.jsx            container: filters, picker, drawer state, derived data
│  ├─ DashboardHUD.jsx         header + subscription pills, ticker, watch-time HUD tiles, smart filter bar
│  ├─ ConstellationGraph.jsx   D3 force graph (size = IMDb + rating; brightness/proximity = taste match)
│  ├─ MovieCard.jsx · DetailDrawer.jsx · NextMoviePicker.jsx · ProfilePanel.jsx
│  └─ shared.jsx               stars, IMDb chip, OTT availability tags (<Badges/>), full-screen wrapper
├─ hooks/
│  ├─ useMovieRecommender.js   TF-IDF / cosine taste engine as a hook (reads the log from localStorage)
│  └─ useCatalog.js            /api/movies → /india_movies.json → bundled mock data
├─ lib/
│  ├─ recommender.js           pure TF-IDF + cosine-similarity engine (no React)
│  ├─ recommend.js             "Pick my next movie" ranking · constants.js · access.js · deck.js · format.js · poster.js
└─ data/india_movies_mock.json 25 Indian movies (themes, director, approx. IMDb scores, illustrative OTT providers)
worker/index.js                Cloudflare Worker: serves dist/ + live TMDB catalog at /api/movies
scripts/sync_india_movies.py   TMDB + IMDb → public/india_movies.json
wrangler.toml · vite.config.js · tailwind.config.js · postcss.config.js · package.json
```

## Posters
Movies carry `poster_path`; the app builds `https://image.tmdb.org/t/p/w500/<poster_path>` (`src/lib/poster.js`; older `w342` URLs in a synced file are upgraded automatically). `<Poster/>` (`src/components/Poster.jsx`) renders a dark gradient + title-typography graphic underneath and fades the image in over it — if a movie has no poster, or the image fails to load, the graphic simply stays. The bundled mock movies have no TMDB poster paths, so they show the graphic. Posters appear on swipe cards (full-bleed, bottom gradient overlay), catalog cards, the graph hover tooltip, the detail drawer and the picker.

## Recommendation engine (`useMovieRecommender`)
- **Features** per movie: genres ×3, themes (TMDB keywords) ×1.5, director ×2, language ×0.5 — multi-word values stay one token (so "Kiran Rao" ≠ "Rajkumar Rao"), weighted by IDF.
- **Taste profile** = Σ rating-weight × movie vector: 5★ +2, 4★ +1, 3★ 0, 2★ −0.5, 1★ −1. Nothing is learned until you rate something 4–5★.
- **Score** = cosine(profile, movie). Unwatched movies are ranked by it; `similarity` (0..1) drives the graph:
  *brightness* (opacity + glow) and *proximity* (a radial force pulls your best matches toward the centre; after each rating the layout re-settles and the stars glide).
- The hook reads the watch log from `localStorage` (`useMovieRecommender(movies)`), or takes the live log (`useMovieRecommender(movies, log)`, what the dashboard does) and stays in sync via the `storage` event and `cineterminal:log`.

