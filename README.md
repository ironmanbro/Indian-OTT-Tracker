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
React 18 · Vite · Tailwind CSS 3 · Framer Motion · D3 · Cloudflare Pages (+ one Pages Function)

## Run locally
```bash
npm install
npm run dev            # http://localhost:5173 — runs on built-in demo data
```
To also test the live-data function locally:
```bash
cp .dev.vars.example .dev.vars     # put your TMDB key in .dev.vars (gitignored)
npm run cf:dev                     # http://localhost:8788 — static site + /api/movies
```

## Data: three layers (the app tries them in order)
1. **`/api/movies`** — Cloudflare Pages Function (`functions/api/movies.js`). Live top-24 India catalog from TMDB, cached 24h at the edge. Needs the `TMDB_API_KEY` secret.
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

> Ratings/director/providers only exist in the live catalog after you run the sync. Re-run it periodically (availability changes) and commit the file; Cloudflare redeploys automatically.

## Deploy to Cloudflare Pages
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick this repo.
2. Build settings:
   - **Framework preset:** Vite (or None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - Environment variable `NODE_VERSION` = `20` (optional; `.node-version` is also included)
3. **Settings → Variables and Secrets** → add secret **`TMDB_API_KEY`** (Production, and Preview if you want). Optional — without it the site uses `/india_movies.json` or the demo data.
4. Deploy. The Pages Function in `functions/` is picked up automatically.

CLI alternative: `npx wrangler login && npm run cf:deploy`.

## Legal / attribution (read before going public or commercial)
- **TMDB**: free API tier is for **non-commercial** use; commercial use needs a written agreement with TMDB. Credit TMDB and **JustWatch** (watch-provider data). The app footer already includes the required notice: *"This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data provided by JustWatch."*
- **IMDb**: ratings come from IMDb's free *non-commercial* datasets — personal/non-commercial use only; check their current terms and attribution wording.
- Provider deep-links in the detail drawer are **search links** (e.g. `netflix.com/search?q=…`), not direct title pages; the URL patterns are best-effort and unverified.

## Project layout
```
src/App.jsx                    the whole app (onboarding, dashboard, constellation)
functions/api/movies.js        Cloudflare Pages Function: live TMDB catalog
scripts/sync_india_movies.py   TMDB + IMDb → public/india_movies.json
public/                        static files (india_movies.json goes here)
wrangler.toml                  Pages config (no secrets)
```
