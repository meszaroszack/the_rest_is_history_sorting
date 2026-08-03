"""Incremental update: fetch RSS feed, tag any new episodes, regenerate all
outputs, without re-tagging existing ones.

Designed to be called from a scheduled task. Idempotent: running it twice
is safe. Exits 0 on success, non-zero on error.

Environment:
- REPO_ROOT      absolute path to the git repo (default: /home/user/workspace/repo)
- RIH_WORK       scratch dir for pipeline artifacts (default: <repo>/rih_work)

Requires pplx_sdk (already available on the Perplexity Computer sandbox).
"""
import json
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

import urllib.request

REPO = Path(os.environ.get("REPO_ROOT", "/home/user/workspace/repo"))
WORK = Path(os.environ.get("RIH_WORK", str(REPO / "rih_work")))
WORK.mkdir(parents=True, exist_ok=True)

# Make the pipeline package importable when this script is run directly
sys.path.insert(0, str(REPO / "pipeline"))
import fetch_extras  # noqa: E402

FEED_URL = "https://feeds.megaphone.fm/GLT4787413333"
DATA_DIR = REPO / "data"
APP_PUBLIC = REPO / "app" / "client" / "public"

# ---- 1. Fetch the feed ---------------------------------------------------
FEED_PATH = WORK / "feed.xml"

def fetch_feed():
    req = urllib.request.Request(FEED_URL, headers={"User-Agent": "rih-atlas/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        FEED_PATH.write_bytes(r.read())
    print(f"[fetch] {FEED_PATH.stat().st_size:,} bytes")


# ---- 2. Parse feed to raw list -------------------------------------------
NS = {
    "itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
    "content": "http://purl.org/rss/1.0/modules/content/",
}

def strip_html(html):
    if not html:
        return ""
    txt = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", unescape(txt)).strip()

def parse_pubdate(s):
    if not s:
        return ""
    try:
        return datetime.strptime(s, "%a, %d %b %Y %H:%M:%S %z").isoformat()
    except Exception:
        return s

def parse_feed():
    tree = ET.parse(FEED_PATH)
    channel = tree.getroot().find("channel")
    episodes = []
    for item in channel.findall("item"):
        title = (item.findtext("title") or "").strip()
        desc_html = item.findtext("description") or ""
        content_encoded = item.findtext("content:encoded", namespaces=NS) or ""
        itunes_summary = item.findtext("itunes:summary", namespaces=NS) or ""
        best = max([desc_html, content_encoded, itunes_summary], key=len)
        description = strip_html(best)
        guid = (item.findtext("guid") or "").strip()
        pubdate = parse_pubdate(item.findtext("pubDate") or "")
        duration = item.findtext("itunes:duration", namespaces=NS) or ""
        ep_num = item.findtext("itunes:episode", namespaces=NS) or ""
        season = item.findtext("itunes:season", namespaces=NS) or ""
        ep_type = item.findtext("itunes:episodeType", namespaces=NS) or ""
        enclosure = item.find("enclosure")
        audio_url = enclosure.get("url") if enclosure is not None else ""
        link = item.findtext("link") or ""

        m = re.match(r"^\s*(\d+)[.:)\s-]+(.*)$", title)
        title_num = int(m.group(1)) if m else None
        title_clean = m.group(2).strip() if m else title

        episodes.append({
            "guid": guid,
            "episode_number": title_num or (int(ep_num) if ep_num.isdigit() else None),
            "title": title,
            "title_clean": title_clean,
            "description": description,
            "pubdate": pubdate,
            "duration": duration,
            "season": season,
            "itunes_episode": ep_num,
            "episode_type": ep_type,
            "audio_url": audio_url,
            "link": link,
        })
    episodes.sort(key=lambda e: e["pubdate"])
    print(f"[parse] {len(episodes)} episodes in feed")
    return episodes


# ---- 3. Load existing tags -----------------------------------------------
EXT_PATH = DATA_DIR / "episodes_extended.jsonl"

def load_existing():
    if not EXT_PATH.exists():
        return {}
    by_guid = {}
    for line in EXT_PATH.read_text().splitlines():
        try:
            row = json.loads(line)
            by_guid[row["guid"]] = row
        except Exception:
            continue
    print(f"[load] {len(by_guid)} existing tagged episodes")
    return by_guid


# ---- 4. Tag only new episodes --------------------------------------------
INSTRUCTION = """You are an expert historian tagging episodes of the popular podcast "The Rest Is History" (hosted by Tom Holland and Dominic Sandbrook).

For each episode, read the title and description and infer the primary historical period covered. Use ONLY information in the title and description; do not invent facts beyond what they support.

Return these fields for each episode:

1. primary_start_year (int): Start year of the main historical focus. Negative for BCE (e.g. -336 for Alexander). Use 0 ONLY if the episode is genuinely undated/purely thematic.
2. primary_end_year (int): End year of the main historical focus. Same rules.
3. primary_region (string): One of "Britain", "Ireland", "France", "Germany", "Italy", "Spain", "Netherlands", "Scandinavia", "Russia", "Eastern Europe", "Europe", "United States", "Latin America", "Africa", "Middle East", "India", "China", "Japan", "Southeast Asia", "Central Asia", "Oceania", "Global", "Mediterranean", "Byzantine", "Ancient Near East", "Undated".
4. era_bucket (string): One of "Prehistory" (before -3000), "Ancient" (-3000 to 500), "Medieval" (500-1500), "Early Modern" (1500-1800), "Long 19th Century" (1800-1914), "World Wars & Interwar" (1914-1945), "Postwar" (1945-1991), "Contemporary" (1991-present), "Undated".
5. themes (array): 1-4 tags from ["War & Military", "Politics & Power", "Monarchy & Royalty", "Religion & Church", "Revolution", "Empire & Colonialism", "Exploration & Discovery", "Science & Technology", "Culture & Arts", "Literature", "Music", "Sport", "Crime & Mystery", "Sex & Scandal", "Disaster & Plague", "Economics & Trade", "Assassination", "Espionage", "Slavery", "Genocide & Atrocity", "Biography", "Ideology", "Diplomacy", "Meta/Podcast"].
6. key_figures (array): Named historical people the episode is primarily ABOUT (not incidental). Max 5.
7. is_series (boolean): True if title contains "Part N".
8. series_name (string): Series title without part suffix, empty if not a series.
9. is_strongly_1800_1934 (boolean): True IFF dominant focus is between 1800 and 1934 inclusive.
10. confidence (string): "high", "medium", or "low".
11. reasoning (string): 1-2 sentences citing specific phrases from the description.
"""

SCHEMA = {
    "type": "object",
    "properties": {
        "primary_start_year": {"type": "integer"},
        "primary_end_year": {"type": "integer"},
        "primary_region": {"type": "string"},
        "era_bucket": {"type": "string"},
        "themes": {"type": "array", "items": {"type": "string"}},
        "key_figures": {"type": "array", "items": {"type": "string"}},
        "is_series": {"type": "boolean"},
        "series_name": {"type": "string"},
        "is_strongly_1800_1934": {"type": "boolean"},
        "confidence": {"type": "string"},
        "reasoning": {"type": "string"},
    },
    "required": [
        "primary_start_year", "primary_end_year", "primary_region",
        "era_bucket", "themes", "is_series", "is_strongly_1800_1934", "reasoning",
    ],
}


def tag_new_episodes(new_eps):
    """Tag new episodes using pplx_sdk. Returns list[dict] with tag fields merged."""
    import pplx_sdk

    items = [
        json.dumps({
            "guid": ep["guid"],
            "title": ep["title"],
            "description": (ep["description"] or "")[:2500],
        })
        for ep in new_eps
    ]
    results = pplx_sdk.llm.extract(
        items=items,
        instruction=INSTRUCTION,
        output_schema=SCHEMA,
        max_tokens=16384,
    )
    tagged = []
    for ep, r in zip(new_eps, results, strict=True):
        merged = {**ep}
        if r.error is not None:
            merged["tag_ok"] = False
            merged["tag_error"] = r.error.to_dict()
            print(f"[tag] FAIL {ep['title'][:60]}: {r.error}")
        else:
            for k, v in (r.result or {}).items():
                merged[k] = v
            merged["tag_ok"] = True
            print(f"[tag] OK   {ep['title'][:60]} -> {merged.get('primary_start_year')}-{merged.get('primary_end_year')} {merged.get('primary_region')}")
        tagged.append(merged)
    return tagged


# ---- 5. Post-process: series detection, playlists, exports ---------------
# (Copied from postprocess.py and export_deliverables.py, adapted to run in one pass.)

import urllib.parse
from collections import Counter, defaultdict

PART_RE = re.compile(r"\s*[\(\-\—:\s]*(?:Part|Pt\.?|part)\s+(\d+)[\)\s]*$", re.VERBOSE)

def strip_part(title):
    t = title.strip()
    m_num = re.match(r'^\s*(\d+)[\.:\)]\s*(.*)$', t)
    base = m_num.group(2) if m_num else t
    m = PART_RE.search(base)
    if m:
        part = int(m.group(1))
        base = PART_RE.sub("", base).strip()
        if ":" in base:
            head = base.split(":", 1)[0].strip()
            base_series = head if len(head) >= 3 else base
        else:
            base_series = base
        return base_series.strip(" -–—:"), part
    return base.strip(), None

def clean_title(title):
    m = re.match(r'^\s*\d+[\.:\)]\s*(.*)$', title)
    return m.group(1).strip() if m else title.strip()

def year_label(a, b):
    if a == 0 and b == 0:
        return "Undated"
    fmt = lambda y: f"{-y} BCE" if y < 0 else str(y)
    return fmt(a) if a == b else f"{fmt(a)} – {fmt(b)}"

def format_date(iso):
    if not iso:
        return ""
    try:
        return datetime.fromisoformat(iso).strftime("%Y-%m-%d")
    except Exception:
        return iso[:10]

def spotify_search(title):
    return f"https://open.spotify.com/search/{urllib.parse.quote(f'The Rest Is History {title}')}"

APPLE_BASE = "https://podcasts.apple.com/us/podcast/the-rest-is-history/id1537788786"

def enrich(ep):
    base, part = strip_part(ep["title"])
    ep["series_key"] = base if part is not None else ""
    ep["part_number"] = part
    ep["display_title"] = clean_title(ep["title"])
    ep["pubdate_short"] = format_date(ep["pubdate"])
    ep["year_label"] = year_label(
        ep.get("primary_start_year", 0) or 0,
        ep.get("primary_end_year", 0) or 0,
    )
    ep["spotify_search_url"] = spotify_search(ep["title"])
    ep["apple_url"] = APPLE_BASE
    slug = re.sub(r'[^a-z0-9]+', '-', ep["title"].lower()).strip('-')
    ep["slug"] = slug[:80]
    return ep


def build_playlists(eps):
    """Build the 52 curated playlists — identical taxonomy to postprocess.py."""
    def sort_key(ep):
        return (ep.get("primary_start_year") or 0, ep["pubdate"])

    def by_pred(name, desc, pred):
        matched = [e for e in eps if pred(e)]
        return {
            "name": name,
            "description": desc,
            "count": len(matched),
            "episode_guids": [e["guid"] for e in sorted(matched, key=sort_key)],
        }

    playlists = []
    for name, desc, era in [
        ("Ancient World", "Bronze Age, Greece, Rome, Persia — the ancient Mediterranean and beyond.", "Ancient"),
        ("The Medieval World", "Byzantium, the Crusades, kings, plagues, and the Middle Ages.", "Medieval"),
        ("Early Modern", "Tudors, Reformation, exploration, and the age of revolutions (1500–1800).", "Early Modern"),
        ("The Long 19th Century", "Napoleon to the eve of WWI — the century that made the modern world.", "Long 19th Century"),
        ("World Wars & Interwar", "1914 to 1945 — total war, revolution, and the age of ideology.", "World Wars & Interwar"),
        ("The Postwar World", "Cold War, decolonisation, and the 20th century's second half.", "Postwar"),
        ("Contemporary History", "1991 to today — from the end of the Cold War to now.", "Contemporary"),
        ("Prehistory & Deep Past", "Before writing — origins, myths, and the earliest civilisations.", "Prehistory"),
    ]:
        playlists.append(by_pred(name, desc, lambda e, era=era: e.get("era_bucket") == era))

    playlists.append(by_pred(
        "The Long 1800–1934",
        "The stretch from Napoleon's rise to the eve of WWII.",
        lambda e: e.get("is_strongly_1800_1934"),
    ))

    region_counter = Counter(e.get("primary_region") for e in eps)
    region_labels = {
        "Britain": "The British Isles: kings, empire, wars, and scandals.",
        "United States": "The American story, from colonies to superpower.",
        "France": "France from the ancien régime to the Fifth Republic.",
        "Germany": "Germany from the Holy Roman Empire to reunification.",
        "Russia": "Russia, from Rurik to Putin.",
        "Italy": "Italy: Rome, Renaissance, Risorgimento, and beyond.",
        "China": "China: dynasties, revolutions, and rise to power.",
        "Middle East": "The Middle East across every era.",
        "India": "The Indian subcontinent through the ages.",
        "Africa": "African history, empires, and the colonial encounter.",
        "Latin America": "Latin America: conquest, revolution, and independence.",
        "Mediterranean": "The Mediterranean world across antiquity.",
        "Europe": "Pan-European stories and cross-border sagas.",
        "Global": "Global-scale stories — pandemics, world wars, world orders.",
        "Ireland": "Ireland, from Celtic origins to the Troubles.",
        "Eastern Europe": "Eastern Europe and the borderlands.",
        "Japan": "Japan, from shogunates to the modern era.",
    }
    for region, d in region_labels.items():
        if region_counter[region] >= 5:
            playlists.append(by_pred(region, d, lambda e, r=region: e.get("primary_region") == r))

    for name, desc, theme in [
        ("War & Battles", "From Marathon to the Marne.", "War & Military"),
        ("Kings & Queens", "Monarchy in all its forms.", "Monarchy & Royalty"),
        ("Revolutions", "Every revolution the show has covered.", "Revolution"),
        ("Empires", "Rise, expansion, and collapse of empires.", "Empire & Colonialism"),
        ("Assassinations & Regicide", "Killings that changed history.", "Assassination"),
        ("Sex, Scandal & Society", "The gossipy, salacious side of the past.", "Sex & Scandal"),
        ("Crime & Mystery", "Historical whodunits and cold cases.", "Crime & Mystery"),
        ("Religion & Belief", "Faith, church, heresy, and the sacred.", "Religion & Church"),
        ("Culture & Arts", "Painters, poets, playwrights.", "Culture & Arts"),
        ("Literature", "Great writers and the books that shaped their times.", "Literature"),
        ("Science & Discovery", "Big ideas, inventors, and scientific revolutions.", "Science & Technology"),
        ("Espionage", "Spies, secrets, and covert operations.", "Espionage"),
        ("Ideology & Politics", "Isms, movements, and political imagination.", "Ideology"),
        ("Slavery", "The history of slavery and its abolition.", "Slavery"),
        ("Disaster & Plague", "Natural and human-made catastrophes.", "Disaster & Plague"),
        ("Sport & Games", "From Olympia to the modern stadium.", "Sport"),
        ("Music", "Great composers and movements.", "Music"),
        ("Biography", "Deep-dive lives of individual historical figures.", "Biography"),
        ("Exploration & Discovery", "Explorers, expeditions, and encounters.", "Exploration & Discovery"),
        ("Genocide & Atrocity", "Confronting the darkest chapters.", "Genocide & Atrocity"),
    ]:
        playlists.append(by_pred(name, desc, lambda e, t=theme: t in (e.get("themes") or [])))

    playlists.append(by_pred("The World Wars", "The First and Second World Wars in depth.",
        lambda e: e.get("era_bucket") == "World Wars & Interwar" and "War & Military" in (e.get("themes") or [])))
    playlists.append(by_pred("Roman History", "Republic, empire, emperors, and the fall of Rome.",
        lambda e: e.get("primary_region") in ("Italy", "Mediterranean")
               and -800 < (e.get("primary_start_year") or 0) < 500))
    playlists.append(by_pred("Tudors & Stuarts", "England from Henry VII to the Glorious Revolution.",
        lambda e: e.get("primary_region") == "Britain" and 1400 <= (e.get("primary_start_year") or 0) <= 1714))
    playlists.append(by_pred("The Napoleonic Age", "From the French Revolution to Waterloo.",
        lambda e: 1789 <= (e.get("primary_start_year") or 0) <= 1815))
    playlists.append(by_pred("American Civil War Era", "Road to war, the war, and Reconstruction.",
        lambda e: e.get("primary_region") == "United States" and 1840 <= (e.get("primary_start_year") or 0) <= 1880))
    playlists.append(by_pred("The 1960s", "Protest, politics, culture, and Cold War flashpoints.",
        lambda e: 1960 <= (e.get("primary_start_year") or 0) <= 1970))
    playlists.append(by_pred("Cold War Flashpoints", "Crises, coups, and confrontations 1945–1991.",
        lambda e: e.get("era_bucket") == "Postwar"
               and any(t in (e.get("themes") or []) for t in ["War & Military", "Diplomacy", "Espionage", "Politics & Power"])))

    playlists = [p for p in playlists if p["count"] > 0]
    for p in playlists:
        p["id"] = re.sub(r'[^a-z0-9]+', '-', p["name"].lower()).strip('-')
        p["spotify_search_url"] = f"https://open.spotify.com/search/{urllib.parse.quote('The Rest Is History ' + p['name'])}"
    return playlists


def build_stats(eps, num_playlists, num_series):
    themes_flat = Counter()
    for e in eps:
        for t in (e.get("themes") or []):
            themes_flat[t] += 1
    return {
        "total_episodes": len(eps),
        "date_range": [eps[0]["pubdate_short"], eps[-1]["pubdate_short"]],
        "eras": dict(Counter(e.get("era_bucket") for e in eps).most_common()),
        "regions": dict(Counter(e.get("primary_region") for e in eps).most_common(20)),
        "themes": dict(themes_flat.most_common(30)),
        "confidence": dict(Counter(e.get("confidence") for e in eps).most_common()),
        "num_series": num_series,
        "num_playlists": num_playlists,
        "num_1800_1934": sum(1 for e in eps if e.get("is_strongly_1800_1934")),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---- 6. Write outputs -----------------------------------------------------
FIELDS_APP = [
    "guid", "episode_number", "title", "display_title", "description", "pubdate",
    "pubdate_short", "duration", "audio_url", "link", "slug",
    "primary_start_year", "primary_end_year", "year_label", "primary_region",
    "era_bucket", "themes", "key_figures", "is_series", "series_key",
    "series_name", "part_number", "is_strongly_1800_1934", "confidence",
    "reasoning", "spotify_search_url", "apple_url",
]

def write_outputs(all_eps, playlists, stats, extras):
    # data/episodes_extended.jsonl (full)
    with (DATA_DIR / "episodes_extended.jsonl").open("w") as f:
        for e in all_eps:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")

    # data/episodes.jsonl (original schema)
    with (DATA_DIR / "episodes.jsonl").open("w") as f:
        for e in all_eps:
            f.write(json.dumps({
                "title": e["title"],
                "primary_start_year": e.get("primary_start_year", 0) or 0,
                "primary_end_year": e.get("primary_end_year", 0) or 0,
                "primary_region": e.get("primary_region", "") or "",
                "is_strongly_1800_1934": bool(e.get("is_strongly_1800_1934")),
                "reasoning": e.get("reasoning", "") or "",
            }, ensure_ascii=False) + "\n")

    # data/episodes.csv
    import csv
    csv_fields = [
        "episode_number", "title", "pubdate_short", "primary_start_year",
        "primary_end_year", "year_label", "primary_region", "era_bucket",
        "themes", "key_figures", "is_series", "series_key", "part_number",
        "is_strongly_1800_1934", "confidence", "reasoning", "duration",
        "audio_url", "spotify_search_url", "guid",
    ]
    with (DATA_DIR / "episodes.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(csv_fields)
        for e in all_eps:
            row = []
            for k in csv_fields:
                v = e.get(k, "")
                if isinstance(v, list):
                    v = "; ".join(str(x) for x in v)
                elif isinstance(v, bool):
                    v = "true" if v else "false"
                elif v is None:
                    v = ""
                row.append(v)
            w.writerow(row)

    (DATA_DIR / "playlists.json").write_text(json.dumps(playlists, ensure_ascii=False, indent=2))
    (DATA_DIR / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2))
    (DATA_DIR / "extras.json").write_text(json.dumps(extras, ensure_ascii=False, indent=2))

    # Duplicate the app-facing files (slim, one-line JSON, no indent)
    slim_eps = [{k: e.get(k) for k in FIELDS_APP} for e in all_eps]
    (APP_PUBLIC / "episodes.json").write_text(json.dumps(slim_eps, ensure_ascii=False))
    (APP_PUBLIC / "playlists.json").write_text(json.dumps(playlists, ensure_ascii=False))
    (APP_PUBLIC / "stats.json").write_text(json.dumps(stats, ensure_ascii=False))
    (APP_PUBLIC / "extras.json").write_text(json.dumps(extras, ensure_ascii=False))

    print(f"[write] {len(all_eps)} episodes, {len(playlists)} playlists")


# ---- Main ----------------------------------------------------------------
def main():
    fetch_feed()
    feed_eps = parse_feed()
    existing = load_existing()

    feed_guids = {e["guid"] for e in feed_eps}
    new_guids = [e for e in feed_eps if e["guid"] not in existing]

    # Always refresh extras (live events, YouTube, club) even when no new episodes.
    # This keeps the home page fresh with tour dates and latest videos.
    if not new_guids:
        print("[main] No new episodes — refreshing extras only.")
        existing_eps = list(existing.values())
        # Enrich existing rows so we have the fields fetch_extras / write_outputs need
        for ep in existing_eps:
            enrich(ep)
        extras = fetch_extras.fetch_all(existing_eps)
        # Rewrite extras.json in both locations
        (DATA_DIR / "extras.json").write_text(json.dumps(extras, ensure_ascii=False, indent=2))
        (APP_PUBLIC / "extras.json").write_text(json.dumps(extras, ensure_ascii=False))
        summary = {
            "new_count": 0,
            "new_episodes": [],
            "extras_refreshed": True,
            "live_events_count": len(extras.get("live_events", [])),
            "youtube_videos_count": len(extras.get("youtube_latest", [])),
            "generated_at": extras["fetched_at"],
        }
        (WORK / "update_summary.json").write_text(json.dumps(summary, indent=2))
        return 0

    print(f"[main] {len(new_guids)} new episodes to tag")
    for e in new_guids:
        print(f"  + {e['title']}")

    tagged_new = tag_new_episodes(new_guids)

    # Merge: existing + newly tagged
    all_by_guid = {**existing}
    for row in tagged_new:
        all_by_guid[row["guid"]] = row

    # Only keep episodes still in the feed (drop removed ones)
    all_eps = [all_by_guid[g] for g in (e["guid"] for e in feed_eps) if g in all_by_guid]

    # Enrich every row (idempotent — safe to re-enrich existing)
    all_eps = [enrich(e) for e in all_eps]

    # Detect series across the whole set
    series_map = defaultdict(list)
    for ep in all_eps:
        if ep.get("series_key"):
            series_map[ep["series_key"]].append(ep)
    real_series_keys = {k for k, v in series_map.items() if len(v) >= 2}
    for ep in all_eps:
        if ep.get("series_key") and ep["series_key"] not in real_series_keys:
            ep["series_key"] = ""
            ep["part_number"] = None
    num_series = len(real_series_keys)

    playlists = build_playlists(all_eps)
    stats = build_stats(all_eps, len(playlists), num_series)
    extras = fetch_extras.fetch_all(all_eps)

    write_outputs(all_eps, playlists, stats, extras)

    # Write a summary file the caller can read to know what happened
    summary = {
        "new_count": len(new_guids),
        "new_episodes": [
            {
                "title": next((t["title"] for t in tagged_new if t["guid"] == e["guid"]), e["title"]),
                "year_label": next((t.get("year_label") or year_label(
                    t.get("primary_start_year", 0) or 0,
                    t.get("primary_end_year", 0) or 0,
                ) for t in tagged_new if t["guid"] == e["guid"]), ""),
                "primary_region": next((t.get("primary_region") for t in tagged_new if t["guid"] == e["guid"]), ""),
                "era_bucket": next((t.get("era_bucket") for t in tagged_new if t["guid"] == e["guid"]), ""),
                "themes": next((t.get("themes") for t in tagged_new if t["guid"] == e["guid"]), []),
            }
            for e in new_guids
        ],
        "total_episodes": len(all_eps),
        "num_playlists": len(playlists),
        "num_1800_1934": stats["num_1800_1934"],
        "generated_at": stats["generated_at"],
        "live_events_count": len(extras.get("live_events", [])),
        "youtube_videos_count": len(extras.get("youtube_latest", [])),
    }
    (WORK / "update_summary.json").write_text(json.dumps(summary, indent=2))
    print(f"[main] Wrote summary to {WORK/'update_summary.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
