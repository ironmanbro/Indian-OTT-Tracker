#!/usr/bin/env python3
"""
Build india_movies.json for the India OTT Watch Tracker.

Pipeline
  1. Stream TMDB's latest daily movie-ID export (files.tmdb.org, no key needed).
  2. Keep the top N by popularity (non-adult, non-video).
  3. Enrich each ID via the TMDB API: /movie/{id}?append_to_response=watch/providers
  4. Keep only movies with India (IN) flatrate / free / ads availability.
  5. Join IMDb ratings (title.ratings.tsv.gz, ~8 MB) using the imdb_id TMDB returns for each movie.
  6. Write india_movies.json in the shape the React app uses.

Usage
  export TMDB_API_KEY=your_key_here      # v3 API key OR v4 read-access token
  python scripts/sync_india_movies.py   # defaults: top 1000 → public/india_movies.json
  python scripts/sync_india_movies.py --top 200 --delay 0.1
  python scripts/sync_india_movies.py --no-imdb          # skip the IMDb rating join

Interrupted runs resume automatically from scripts/.cache/india_movies.cache.jsonl
(delete that file to force a full refresh).

IMDb ratings come from IMDb's free non-commercial datasets (https://developer.imdb.com/non-commercial-datasets/),
which are licensed for personal / non-commercial use only — check their current terms before any commercial use.

Attribution (required by TMDB's terms): "This product uses the TMDB API but is not
endorsed or certified by TMDB." Streaming availability data is provided by JustWatch.
TMDB's free tier is for non-commercial use only.
"""
import argparse
import gzip
import heapq
import json
import os
import re
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone

import requests

IMDB_RATINGS_URL = "https://datasets.imdbws.com/title.ratings.tsv.gz"
EXPORT_URL = "https://files.tmdb.org/p/exports/movie_ids_{date}.json.gz"
API_BASE = "https://api.themoviedb.org/3"
POSTER_BASE = "https://image.tmdb.org/t/p/w500"
REGION = "IN"

# TMDB provider names -> the app's subscription pill names. Unmatched names pass through.
PILL_RULES = [
    (re.compile(r"^netflix", re.I), "Netflix"),
    (re.compile(r"prime video", re.I), "Amazon Prime Video"),
    (re.compile(r"hotstar", re.I), "JioHotstar"),
    (re.compile(r"zee ?5", re.I), "Zee5"),
    (re.compile(r"sony ?liv", re.I), "SonyLIV"),
    (re.compile(r"jio ?cinema", re.I), "JioCinema"),
]


def normalize_provider(name: str) -> str:
    for rx, pill in PILL_RULES:
        if rx.search(name):
            return pill
    return name


def uniq(items):
    return list(dict.fromkeys(items))  # order-preserving de-dupe


# ───────────────────────── 1. Export download ─────────────────────────

def download_export(dest_dir: str, max_back_days: int = 4) -> str:
    """Stream the newest available export to disk; returns the .gz path.
    Exports are published daily (UTC morning), so walk back a few days if needed."""
    now = datetime.now(timezone.utc)
    last_err = None
    for back in range(1, max_back_days + 1):
        date = (now - timedelta(days=back)).strftime("%m_%d_%Y")
        url = EXPORT_URL.format(date=date)
        print(f"[export] trying {url}")
        try:
            with requests.get(url, stream=True, timeout=60) as r:
                if r.status_code != 200:
                    last_err = f"HTTP {r.status_code}"
                    continue
                path = os.path.join(dest_dir, f"movie_ids_{date}.json.gz")
                with open(path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=1 << 20):
                        f.write(chunk)
                print(f"[export] saved {os.path.getsize(path) / 1e6:.1f} MB")
                return path
        except requests.RequestException as e:
            last_err = str(e)
    raise RuntimeError(f"No TMDB export found in the last {max_back_days} days ({last_err})")


# ───────────────────────── 2. Top-N selection ─────────────────────────

def top_popular_ids(gz_path: str, n: int):
    """Stream the JSON-Lines export, keep the n most popular non-adult, non-video movies."""
    def records():
        with gzip.open(gz_path, "rt", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if rec.get("adult") or rec.get("video"):
                    continue
                yield rec

    top = heapq.nlargest(n, records(), key=lambda r: r.get("popularity") or 0)  # O(1M) time, O(n) memory
    print(f"[export] selected top {len(top)} by popularity "
          f"(popularity {top[0]['popularity']:.1f} → {top[-1]['popularity']:.1f})")
    return [r["id"] for r in top]


# ───────────────────────── 3. API enrichment ─────────────────────────

class Tmdb:
    def __init__(self, key: str, delay: float):
        self.delay = delay
        self.s = requests.Session()
        self.s.headers["accept"] = "application/json"
        self.params = {}
        if len(key) > 60:  # v4 read-access token (JWT)
            self.s.headers["Authorization"] = f"Bearer {key}"
        else:              # v3 key
            self.params["api_key"] = key

    def movie(self, movie_id: int, retries: int = 4):
        """Returns the JSON dict, or None for 404. Retries on 429/5xx/network errors."""
        # Note: the region filter is applied client-side below — watch/providers returns every
        # country under results.<CC>, so we read results["IN"] rather than rely on a query param.
        params = {**self.params, "append_to_response": "watch/providers,credits,keywords", "language": "en-US"}
        for attempt in range(retries):
            try:
                r = self.s.get(f"{API_BASE}/movie/{movie_id}", params=params, timeout=30)
            except requests.RequestException:
                time.sleep(2 ** attempt)
                continue
            if r.status_code == 200:
                time.sleep(self.delay)
                return r.json()
            if r.status_code == 404:
                return None
            if r.status_code == 401:
                raise SystemExit("TMDB rejected the API key (401). Check TMDB_API_KEY.")
            if r.status_code == 429:
                wait = float(r.headers.get("Retry-After", 2 ** (attempt + 1)))
                print(f"[api] rate limited, sleeping {wait:.0f}s")
                time.sleep(wait)
                continue
            time.sleep(2 ** attempt)  # 5xx etc.
        return None


def to_movie(d: dict, languages=None, keep_unavailable=False):
    """TMDB details -> app movie dict, or None if it has no India streaming data."""
    rp = (d.get("watch/providers") or {}).get("results", {}).get(REGION) or {}

    def names(key):
        return [normalize_provider(p["provider_name"]) for p in rp.get(key, [])]

    flatrate = uniq(names("flatrate"))
    free = uniq(names("free") + names("ads"))  # "free" and "free with ads" both count as free
    if languages and d.get("original_language") not in languages:
        return None  # e.g. --languages en,hi → Hollywood + Bollywood only
    if not flatrate and not free and not keep_unavailable:
        return None  # rent/buy-only or unavailable in India

    genres = [g["name"] for g in d.get("genres", [])]
    runtime = d.get("runtime") or 0
    if not genres or runtime <= 0:
        return None

    return {
        "id": str(d["id"]),
        "title": d.get("title") or d.get("original_title"),
        "genres": genres,
        "runtime": runtime,
        "platforms": {"flatrate": flatrate, "free": free},
        "poster": f"{POSTER_BASE}{d['poster_path']}" if d.get("poster_path") else None,  # https://image.tmdb.org/t/p/w500/<poster_path>
        "poster_path": d.get("poster_path") or None,
        "year": int(d["release_date"][:4]) if d.get("release_date") else None,
        "language": d.get("original_language"),
        # TMDB's /movie/{id} response carries the IMDb id; the rating is joined in later (attach_ratings)
        # TMDB keywords → themes (e.g. "folk-horror", "small-town"); feeds the recommender's theme features
        "themes": [re.sub(r"\s+", "-", k["name"].strip().lower()) for k in (d.get("keywords") or {}).get("keywords", [])][:8],
        "director": ", ".join(c["name"] for c in (d.get("credits") or {}).get("crew", []) if c.get("job") == "Director")[:80] or None,
        "imdb_id": d.get("imdb_id") or None,
        "imdb_rating": None,
        "imdb_votes": None,
    }


def enrich(ids, client: Tmdb, cache_path: str, languages=None, keep_unavailable=False):
    """Fetch every id, resuming from a JSONL cache. Cache stores the final decision per id."""
    done = {}
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as f:
            for line in f:
                try:
                    rec = json.loads(line)
                    mv = rec["movie"]
                    if mv is not None and ("imdb_id" not in mv or "director" not in mv or "themes" not in mv):
                        continue  # cached before IMDb/director support → refetch
                    done[rec["id"]] = mv  # movie may be null (= checked, no IN data)
                except (json.JSONDecodeError, KeyError):
                    pass
        print(f"[api] resuming: {len(done)} ids already processed")

    started = time.time()
    with open(cache_path, "a", encoding="utf-8") as cache:
        for i, mid in enumerate(ids, 1):
            if mid in done:
                continue
            d = client.movie(mid)
            movie = to_movie(d, languages, keep_unavailable) if d else None
            done[mid] = movie
            cache.write(json.dumps({"id": mid, "movie": movie}, ensure_ascii=False) + "\n")
            cache.flush()
            if i % 50 == 0 or i == len(ids):
                kept = sum(1 for v in done.values() if v)
                print(f"[api] {i}/{len(ids)} processed · {kept} kept · {time.time() - started:.0f}s")

    return [done[mid] for mid in ids if done.get(mid)]  # preserves popularity order


# ───────────────────────── 5. IMDb ratings ─────────────────────────

def download_ratings(dest_dir: str) -> str:
    """Stream IMDb's ratings dataset (tconst, averageRating, numVotes) to disk."""
    path = os.path.join(dest_dir, "title.ratings.tsv.gz")
    print(f"[imdb] downloading {IMDB_RATINGS_URL}")
    with requests.get(IMDB_RATINGS_URL, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)
    print(f"[imdb] saved {os.path.getsize(path) / 1e6:.1f} MB")
    return path


def load_ratings(path: str, wanted: set):
    """Stream the TSV and keep only the ids we need → {tconst: (rating, votes)}. Constant memory."""
    out = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        next(f, None)  # header: tconst  averageRating  numVotes
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) == 3 and parts[0] in wanted:
                try:
                    out[parts[0]] = (float(parts[1]), int(parts[2]))
                except ValueError:
                    pass
    return out


def attach_ratings(movies, ratings):
    """Fill imdb_rating / imdb_votes in place; returns how many movies got a rating."""
    hit = 0
    for mv in movies:
        r = ratings.get(mv.get("imdb_id"))
        if r:
            mv["imdb_rating"], mv["imdb_votes"] = r
            hit += 1
    return hit


# ───────────────────────── 6. Output ─────────────────────────

def save(movies, out_path: str):
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "region": REGION,
        "attribution": "This product uses the TMDB API but is not endorsed or certified by TMDB. "
                       "Streaming availability data provided by JustWatch. "
                       "Ratings from IMDb's non-commercial datasets.",
        "movies": movies,
    }
    tmp = out_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    os.replace(tmp, out_path)  # atomic: never leave a half-written file
    print(f"[done] wrote {len(movies)} movies → {out_path}")


def main():
    ap = argparse.ArgumentParser(description="Build india_movies.json from TMDB")
    ap.add_argument("--top", type=int, default=1000, help="how many most-popular movies to examine")
    ap.add_argument("--delay", type=float, default=0.1, help="seconds between API calls (TMDB allows ~50 req/s)")
    ap.add_argument("--out", default="public/india_movies.json", help="output file (default: public/india_movies.json, served by the site)")
    ap.add_argument("--languages", default="", help="comma-separated TMDB original_language codes to keep, e.g. en,hi for Hollywood + Bollywood")
    ap.add_argument("--keep-unavailable", action="store_true", help="keep movies with no India streaming listing (grows the catalog)")
    ap.add_argument("--no-imdb", action="store_true", help="skip joining IMDb ratings")
    args = ap.parse_args()

    key = os.environ.get("TMDB_API_KEY", "").strip()
    if not key or key == "YOUR_TMDB_API_KEY":
        sys.exit("Set TMDB_API_KEY first:  export TMDB_API_KEY=your_key_here")

    with tempfile.TemporaryDirectory() as tmp:
        gz = download_export(tmp)
        ids = top_popular_ids(gz, args.top)

    # Resume cache lives OUTSIDE public/ so it is never deployed (gitignored: scripts/.cache/)
    cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache")
    os.makedirs(cache_dir, exist_ok=True)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    cache_path = os.path.join(cache_dir, os.path.splitext(os.path.basename(args.out))[0] + ".cache.jsonl")
    langs = {x.strip() for x in args.languages.split(",") if x.strip()} or None
    movies = enrich(ids, Tmdb(key, args.delay), cache_path, langs, args.keep_unavailable)
    for m in movies:
        m["industry"] = "Bollywood" if m.get("language") == "hi" else "Hollywood" if m.get("language") == "en" else None

    if not args.no_imdb:
        try:  # ratings are a nice-to-have: never fail the whole sync because of them
            with tempfile.TemporaryDirectory() as tmp:
                ratings = load_ratings(download_ratings(tmp), {m["imdb_id"] for m in movies if m.get("imdb_id")})
            hit = attach_ratings(movies, ratings)
            print(f"[imdb] rated {hit}/{len(movies)} movies")
        except (requests.RequestException, OSError) as e:
            print(f"[imdb] skipped ({e}); continuing without ratings")

    save(movies, args.out)


if __name__ == "__main__":
    main()
