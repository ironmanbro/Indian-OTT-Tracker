#!/usr/bin/env python3
"""
Keyless catalog builder: Hollywood + Bollywood movies from IMDb's free non-commercial datasets
(https://developer.imdb.com/non-commercial-datasets/). No API key needed.

  python3 scripts/build_imdb_catalog.py                     # → public/india_movies.json
  python3 scripts/build_imdb_catalog.py --hollywood 2000 --bollywood 1200

How movies are classified (IMDb datasets carry no "original language" column, so this is a heuristic):
  Bollywood  = director is on the Hindi-cinema director list below (plus a few hand-picked titles)
  Hollywood  = English-titled original (a US/GB/AU/CA alternate title equals the original title), not Bollywood,
               and not by a known South-Indian director
Streaming availability is NOT in IMDb's data, so `platforms` is left empty ("availability not tracked").
For exact language + India availability, run scripts/sync_india_movies.py with a TMDB key
(it supports --languages en,hi --keep-unavailable). Posters: `npm run posters -- --file public/india_movies.json`.
"""
import argparse, gzip, json, os
from datetime import datetime, timezone

HINDI_DIRECTORS = {
    "Raj Kapoor", "Guru Dutt", "Bimal Roy", "Mehboob Khan", "K. Asif", "Yash Chopra", "Aditya Chopra", "Karan Johar",
    "Rajkumar Hirani", "Zoya Akhtar", "Farhan Akhtar", "Anurag Kashyap", "Vishal Bhardwaj", "Sanjay Leela Bhansali",
    "Imtiaz Ali", "Ashutosh Gowariker", "Nitesh Tiwari", "Rohit Shetty", "Farah Khan", "Kabir Khan", "Sriram Raghavan",
    "Dibakar Banerjee", "Ayan Mukerji", "Shoojit Sircar", "Anubhav Sinha", "Meghna Gulzar", "Gulzar", "Mansoor Khan",
    "David Dhawan", "Priyadarshan", "Anees Bazmee", "Indra Kumar", "Sooraj R. Barjatya", "Subhash Ghai", "Ram Gopal Varma",
    "Mahesh Bhatt", "Vikram Bhatt", "Mohit Suri", "Anurag Basu", "Rakeysh Omprakash Mehra", "Aamir Khan", "Abhishek Chaubey",
    "Neeraj Pandey", "Shimit Amin", "Nikkhil Advani", "Sajid Nadiadwala", "Siddharth Anand", "Ali Abbas Zafar", 
    "Remo D'Souza", "Abhinay Deo", "Raj Kumar Gupta", "Rajkumar Gupta", "Sujoy Ghosh", "Kiran Rao", "Gauri Shinde",
    "Alankrita Shrivastava", "Hansal Mehta", "Vikas Bahl", "Shakun Batra", "Reema Kagti", "Luv Ranjan", "Homi Adajania",
    "Ritesh Batra", "Manmohan Desai", "Prakash Mehra", "Ramesh Sippy", "Hrishikesh Mukherjee", "Basu Chatterjee",
    "Shyam Benegal", "Govind Nihalani", "Sudhir Mishra", "Tigmanshu Dhulia", "Ketan Mehta", "Kundan Shah",
    "Saeed Akhtar Mirza", "Raj Khosla", "Vijay Anand", "Dev Anand", "Shakti Samanta", "Nasir Hussain", "Manoj Kumar",
    "Sanjay Gupta", "Rajiv Rai", "Mukul S. Anand", "Ram Madhvani", "Ajay Devgn", "Ashwiny Iyer Tiwari", "Amit Sharma",
    "Laxman Utekar", "Abhishek Kapoor", "Abhishek Sharma", "Aanand L. Rai", "Navdeep Singh", "Tarun Mansukhani",
    "Milan Luthria", "Ahmed Khan", "Vipul Amrutlal Shah", "Vipul Shah", "Rohan Sippy", "Kunal Kohli", "Pradeep Sarkar",
    "Vidhu Vinod Chopra", "Rajat Kapoor", "Karan Malhotra", "Punit Malhotra", "Shashank Khaitan", "Sanjay Khan",
    "Feroz Khan", "Rahul Dholakia", "Anil Sharma", "J.P. Dutta", "Rajkumar Santoshi", "Tanuja Chandra", "Sabir Khan",
    "Madhur Bhandarkar", "Prakash Jha", "Mahesh Manjrekar", "Nagesh Kukunoor", "Amar Kaushik", "Soumik Sen",
    "Ravi Chopra", "B.R. Chopra", "Kamal Amrohi", "Chetan Anand", "Rensil D'Silva", "Mudassar Aziz", "Raj Mehta",
    "Sharat Katariya", "Amit Masurkar", "Vasan Bala", "Nikhil Nagesh Bhat", "Rajesh Mapuskar", "Nupur Asthana",
    "Chandra Prakash Dwivedi", "Anurag Singh", "Rahul Rawail", "Satish Kaushik", "Sai Paranjpye", "Vikramaditya Motwane",
    "Ashim Ahluwalia", "Aditya Dhar", "R. Balki", "Sudip Sharma", "Amole Gupte", "Leena Yadav", "Kanu Behl",
    "Raj Nidimoru", "Krishna D.K.", "Abbas Tyrewala", "Shirish Kunder", "Maneesh Sharma", "Habib Faisal", "Onir",
    "Pawan Kripalani", "Anand Gandhi", "Ashish R. Mohan", "Mohit Jha", "Tarun Dudeja", "Sriram Raghavan",
    "Sudhir Kumar", "Pankaj Kapur", "Danish Aslam", "Sachin Kundalkar", "Soumendra Padhi", "Atul Sabharwal",
}
SOUTH_DIRECTORS = {
    "S.S. Rajamouli", "S. S. Rajamouli", "Prashanth Neel", "Lokesh Kanagaraj", "Mani Ratnam", "Shankar", "S. Shankar",
    "Atlee", "Rishab Shetty", "Sukumar", "Nag Ashwin", "Jeethu Joseph", "Trivikram Srinivas", "Koratala Siva", "Boyapati Srinu",
    "Puri Jagannadh", "V.V. Vinayak", "A.R. Murugadoss", "Vetrimaaran", "Pa. Ranjith", "Karthik Subbaraj", "Nelson Dilipkumar",
    "H. Vinoth", "Sundar C.", "Gautham Vasudev Menon", "Lijo Jose Pellissery", "Dileesh Pothan", "Anjali Menon", "Aashiq Abu",
    "Prithviraj Sukumaran", "Basil Joseph", "Chidambaram S. Poduval", "Khalid Rahman", "Rajeev Ravi", "Sathyan Anthikad",
    "Vineeth Sreenivasan", "Alphonse Puthren", "Anwar Rasheed", "Shaji Kailas", "Jude Anthany Joseph", "Girish Kasaravalli",
    "Pawan Kumar", "Hemanth M. Rao", "Sandeep Reddy Vanga", "Venky Atluri", "Sekhar Kammula", "Krish Jagarlamudi",
    "Anil Ravipudi", "Harish Shankar", "Srinu Vaitla", "Vamshi Paidipally", "K. Balachander", "Bharathiraja", "Bala",
    "Selvaraghavan", "Mari Selvaraj", "Thiagarajan Kumararaja", "Vignesh Shivan", "Karthik Naren", "Venkat Prabhu", "Hari",
    "K.S. Ravikumar", "Mysskin", "Nithilan Saminathan", "Tharun Moorthy", "Ranjith Sankar", "Mahesh Narayanan",
    "Vasishta N. Simha", "Pradeep Ranganathan", "Shiva Nirvana", "Bejoy Nambiar", "Sujeeth", "Vivek Athreya",
    "Gopichand Malineni", "Teja", "Krishna Vamsi", "Ram", "Madhupal", "Siddique", "Joshiy", "Sudeep", "Upendra", "Prem",
}
NOT_HINDI_TITLES = {"Vandanam", "Midhunam", "Minnaram", "Chandralekha", "Pournami", "Kaalapani", "Thenmavin Kombathu", "Kilukkam", "Chithram", "Aryan", "Pavithram", "Kakkakuyil", "Boeing Boeing", "Vellanakalude Nadu"}  # Malayalam/Telugu films by dual-industry directors
BOLLYWOOD_TITLES = {"Animal", "Kabir Singh", "Jawan"}  # South-Indian directors, Hindi-first / Hindi-wide releases
HIDE_GENRES = {"Short", "News", "Talk-Show", "Reality-TV", "Game-Show", "Adult"}
GENRE_MAP = {"Sci-Fi": "Science Fiction", "Film-Noir": "Film Noir"}
ENGLISH_REGIONS = {"US", "GB", "AU", "CA"}


def open_tsv(path):
    f = gzip.open(path, "rt", encoding="utf-8")
    next(f)
    for line in f:
        yield line.rstrip("\n").split("\t")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="/tmp/imdb", help="folder holding the IMDb *.tsv.gz files (downloaded if missing)")
    ap.add_argument("--hollywood", type=int, default=1800)
    ap.add_argument("--bollywood", type=int, default=1000)
    ap.add_argument("--min-votes-h", type=int, default=25000)
    ap.add_argument("--min-votes-b", type=int, default=3000)
    ap.add_argument("--out", default="public/india_movies.json")
    a = ap.parse_args()

    os.makedirs(a.dir, exist_ok=True)
    for name in ("title.basics", "title.ratings", "title.akas", "title.crew", "name.basics"):
        p = os.path.join(a.dir, f"{name}.tsv.gz")
        if not os.path.exists(p):
            import urllib.request
            print(f"[dl] {name}")
            urllib.request.urlretrieve(f"https://datasets.imdbws.com/{name}.tsv.gz", p)
    P = lambda n: os.path.join(a.dir, f"{n}.tsv.gz")

    ratings = {t: (float(r), int(v)) for t, r, v in open_tsv(P("title.ratings"))}
    min_v = min(a.min_votes_h, a.min_votes_b)
    cand = {}
    for t, typ, ptitle, otitle, adult, year, _end, rt, genres in open_tsv(P("title.basics")):
        if typ != "movie" or adult == "1" or t not in ratings or ratings[t][1] < min_v:
            continue
        if not rt.isdigit() or int(rt) < 60 or not year.isdigit() or int(year) > datetime.now().year:
            continue
        gl = [GENRE_MAP.get(g, g) for g in genres.split(",") if g != "\\N" and g not in HIDE_GENRES]
        if not gl:
            continue
        cand[t] = dict(title=ptitle, orig=otitle, year=int(year), runtime=int(rt), genres=gl)
    print(f"[basics] {len(cand)} candidate movies")

    en_orig = set()  # US/GB/AU/CA alternate title identical to the original title → English-language original
    for row in open_tsv(P("title.akas")):
        c = cand.get(row[0])
        if c and row[3] in ENGLISH_REGIONS and row[2] == c["orig"]:
            en_orig.add(row[0])
    print(f"[akas] {len(en_orig)} English-titled originals")

    dirs, need_people = {}, set()
    for t, d, _w in open_tsv(P("title.crew")):
        if t in cand and d != "\\N":
            dirs[t] = d.split(",")
            need_people.update(dirs[t])
    names = {row[0]: row[1] for row in open_tsv(P("name.basics")) if row[0] in need_people}
    print(f"[crew] resolved {len(names)} director names")

    hi, en = [], []
    for t, c in cand.items():
        dnames = [names.get(n, "") for n in dirs.get(t, [])]
        votes = ratings[t][1]
        c.update(id=t, director=", ".join(d for d in dnames if d)[:80] or None, rating=ratings[t][0], votes=votes)
        if c["title"] in NOT_HINDI_TITLES:
            continue
        if c["title"] in BOLLYWOOD_TITLES or any(d in HINDI_DIRECTORS for d in dnames):
            if votes >= a.min_votes_b:
                c["industry"] = "Bollywood"; hi.append(c)
        elif t in en_orig and c["title"] == c["orig"] and not any(d in SOUTH_DIRECTORS for d in dnames) and votes >= a.min_votes_h:
            c["industry"] = "Hollywood"; en.append(c)
    hi = sorted(hi, key=lambda c: -c["votes"])[: a.bollywood]
    en = sorted(en, key=lambda c: -c["votes"])[: a.hollywood]

    allm = sorted(hi + en, key=lambda c: -c["votes"])  # interleaved by popularity → onboarding deck mixes both
    out = [{
        "id": c["id"], "title": c["title"], "genres": c["genres"][:4], "themes": [], "runtime": c["runtime"], "year": c["year"],
        "language": "hi" if c["industry"] == "Bollywood" else "en", "industry": c["industry"], "director": c["director"],
        "platforms": {"flatrate": [], "free": []}, "poster": None, "poster_path": None,
        "imdb_id": c["id"], "imdb_rating": c["rating"], "imdb_votes": c["votes"],
    } for c in allm]
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "region": "IN", "availability": False,
        "attribution": "Catalog and ratings from IMDb's non-commercial datasets (personal / non-commercial use). "
                       "Streaming availability is not tracked in this catalog.",
        "movies": out,
    }
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[done] {len(hi)} Bollywood + {len(en)} Hollywood → {a.out} ({os.path.getsize(a.out)/1e3:.0f} KB)")


if __name__ == "__main__":
    main()
