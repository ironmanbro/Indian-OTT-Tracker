#!/usr/bin/env python3
"""
Fill in movie posters from TMDB (free API key; images are hosted by TMDB, so nothing is scraped or re-hosted).

    export TMDB_API_KEY=your_key            # v3 API key OR v4 read-access token (themoviedb.org → Settings → API)

    python scripts/fetch_posters.py                      # fill src/data/india_movies_mock.json (the 25 demo movies)
    python scripts/fetch_posters.py --file public/india_movies.json     # or any catalog file
    python scripts/fetch_posters.py --dry-run            # show matches, change nothing
    python scripts/fetch_posters.py --imdb tt1375666 tt0169102          # IMDb id → poster URL (prints JSON)

How a movie is matched (no guessing):
  1. it already has `imdb_id`  → TMDB /find (exact, unambiguous)
  2. otherwise title (+ year ±1 when the movie has one) → TMDB search; only an EXACT title match is accepted
     (English title, original title, or the part before a colon), the most popular such match wins.
     No exact match → reported as "no match" and left untouched. Fix those by adding "imdb_id": "tt…" to the movie.
Each matched movie gets `poster_path`, `poster` (https://image.tmdb.org/t/p/w500/<poster_path>) and, if missing, `imdb_id`.
Existing poster_path values are kept unless you pass --force.

Credit TMDB on your site (the app footer already does). Free tier = non-commercial use; see TMDB's API terms.
"""
import argparse
import json
import os
import re
import sys
import time

import requests

API = "https://api.themoviedb.org/3"
IMG = "https://image.tmdb.org/t/p/w500"
DEFAULT_FILE = "src/data/india_movies_mock.json"


def norm(s: str) -> str:
    """Lower-case, strip accents-ish punctuation: 'Baahubali: The Beginning' == 'baahubali the beginning'."""
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


class Tmdb:
    def __init__(self, key: str, delay: float = 0.1):
        self.delay = delay
        self.s = requests.Session()
        self.s.headers["accept"] = "application/json"
        self.params = {}
        if len(key) > 60:  # v4 read token (JWT)
            self.s.headers["Authorization"] = f"Bearer {key}"
        else:              # v3 key
            self.params["api_key"] = key

    def get(self, path: str, **params):
        """GET with retries on 429/5xx. Returns JSON, or None on 404. Exits on 401."""
        for attempt in range(4):
            try:
                r = self.s.get(f"{API}{path}", params={**self.params, **params}, timeout=30)
            except requests.RequestException:
                time.sleep(2 ** attempt)
                continue
            if r.status_code == 200:
                time.sleep(self.delay)
                return r.json()
            if r.status_code == 404:
                return None
            if r.status_code == 401:
                sys.exit("TMDB rejected the API key (401). Check TMDB_API_KEY.")
            time.sleep(float(r.headers.get("Retry-After", 2 ** (attempt + 1))) if r.status_code == 429 else 2 ** attempt)
        return None

    def by_imdb(self, imdb_id: str):
        data = self.get(f"/find/{imdb_id}", external_source="imdb_id") or {}
        hits = data.get("movie_results") or []
        return hits[0] if hits else None

    def by_title(self, title: str, year=None):
        params = {"query": title, "include_adult": "false", "language": "en-US"}
        if year:
            params["primary_release_year"] = year
        results = (self.get("/search/movie", **params) or {}).get("results", [])
        want = norm(title)
        # original_title is often in Devanagari/Tamil/... script, and English titles can carry a subtitle
        # ("Stree 2: Sarkate Ka Aatank"), so also accept the part before the colon — still an exact comparison.
        def names(m):
            t = m.get("title") or ""
            return {norm(t), norm(m.get("original_title")), norm(t.split(":")[0])}
        exact = [m for m in results if want in names(m)]
        if year:  # tolerate release-date differences between festival / theatrical dates
            exact = [m for m in exact if (m.get("release_date") or "0000")[:4].isdigit()
                     and abs(int(m["release_date"][:4]) - int(year)) <= 1] or exact
        return max(exact, key=lambda m: m.get("popularity") or 0) if exact else None

    def imdb_id_of(self, tmdb_id: int):
        return (self.get(f"/movie/{tmdb_id}") or {}).get("imdb_id") or None


def fill(movies, client: Tmdb, force=False, dry=False):
    """Fill poster fields in place. Returns [(title, status, detail)]."""
    report = []
    for mv in movies:
        title = mv.get("title", "?")
        if mv.get("poster_path") and not force:
            report.append((title, "kept", mv["poster_path"]))
            continue
        hit = client.by_imdb(mv["imdb_id"]) if mv.get("imdb_id") else None
        how = "imdb_id"
        if not hit:
            hit, how = client.by_title(title, mv.get("year")), "title"
        if not hit or not hit.get("poster_path"):
            report.append((title, "no match" if not hit else "no poster", ""))
            continue
        if not dry:
            mv["poster_path"] = hit["poster_path"]
            mv["poster"] = f"{IMG}{hit['poster_path']}"
            if not mv.get("imdb_id"):
                mv["imdb_id"] = client.imdb_id_of(hit["id"])
        report.append((title, f"matched by {how}", f"{IMG}{hit['poster_path']}"))
    return report


def main():
    ap = argparse.ArgumentParser(description="Fill movie posters from TMDB")
    ap.add_argument("--file", default=DEFAULT_FILE, help=f"catalog JSON (list, or {{'movies': [...]}}); default {DEFAULT_FILE}")
    ap.add_argument("--imdb", nargs="+", metavar="ttXXXXXXX", help="just print poster URLs for these IMDb ids")
    ap.add_argument("--force", action="store_true", help="replace existing poster_path values")
    ap.add_argument("--dry-run", action="store_true", help="show what would change, write nothing")
    ap.add_argument("--delay", type=float, default=0.1, help="seconds between API calls")
    args = ap.parse_args()

    key = os.environ.get("TMDB_API_KEY", "").strip()
    if not key or key == "YOUR_TMDB_API_KEY":
        sys.exit("Set TMDB_API_KEY first:  export TMDB_API_KEY=your_key_here  (free key: themoviedb.org → Settings → API)")
    client = Tmdb(key, args.delay)

    if args.imdb:  # IMDb id → poster URL
        out = {}
        for tt in args.imdb:
            hit = client.by_imdb(tt)
            out[tt] = {"title": hit["title"], "poster": f"{IMG}{hit['poster_path']}"} if hit and hit.get("poster_path") else None
        print(json.dumps(out, indent=2, ensure_ascii=False))
        return

    with open(args.file, encoding="utf-8") as f:
        data = json.load(f)
    movies = data if isinstance(data, list) else data["movies"]
    report = fill(movies, client, force=args.force, dry=args.dry_run)

    w = max(len(r[0]) for r in report)
    for title, status, detail in report:
        print(f"  {title:<{w}}  {status:<18} {detail}")
    matched = sum(1 for r in report if r[1].startswith("matched"))
    print(f"\n{matched} matched · {sum(1 for r in report if r[1] == 'kept')} already had a poster · "
          f"{sum(1 for r in report if r[1] in ('no match', 'no poster'))} unmatched")

    if args.dry_run:
        print("(dry run — nothing written)")
        return
    tmp = args.file + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, args.file)  # atomic
    print(f"wrote {args.file}")


if __name__ == "__main__":
    main()
