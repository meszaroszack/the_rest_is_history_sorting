"""Post-process tagged episodes:
- Deterministic series detection + normalized series_name (strip Part N)
- Match episodes to Spotify search links + Apple links
- Compute display fields
- Group into thematic playlists

Writes:
- episodes_final.json (array, for web app)
- playlists.json (curated thematic playlists)
- stats.json (summary stats for landing page)
"""
import json
import re
import urllib.parse
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime

RD = Path("/home/user/workspace/rih")
IN = RD / "episodes_tagged.jsonl"
OUT_EPS = RD / "episodes_final.json"
OUT_PLAYLISTS = RD / "playlists.json"
OUT_STATS = RD / "stats.json"

eps = [json.loads(l) for l in IN.read_text().splitlines()]

# ---- Deterministic series detection --------------------------------------
# Patterns like:
#   "689. A Murderous Affair: The Habsburgs' Greatest Scandal (Part 1)"
#   "137. 1922: The Birth of the Modern World Part 2"
#   "58. The World Cup of Gods - Part 1"
PART_RE = re.compile(r"""
    \s*
    [\(\-\—:\s]*             # optional opening bracket, dash, colon, space
    (?:Part|Pt\.?|part)\s+
    (\d+)
    [\)\s]*$                 # optional closing bracket
""", re.VERBOSE)

def strip_part(title: str):
    """Return (base_title, part_number_or_None). Handles multiple bracket styles."""
    t = title.strip()
    # Remove episode number prefix like "689. " or "137: "
    m_num = re.match(r'^\s*(\d+)[\.:\)]\s*(.*)$', t)
    if m_num:
        base = m_num.group(2)
    else:
        base = t
    # Try trailing "Part N"
    m = PART_RE.search(base)
    if m:
        part = int(m.group(1))
        base = PART_RE.sub("", base).strip()
        # Some titles have "Series Name: Sub-title (Part 1)" — the "sub-title"
        # varies per episode. Collapse to just the part before the colon.
        # But only if the pre-colon segment isn't itself just a year.
        if ":" in base:
            head, tail = base.split(":", 1)
            head = head.strip()
            if len(head) >= 3:
                base_series = head
            else:
                base_series = base
        else:
            base_series = base
        return base_series.strip(" -–—:"), part
    return base.strip(), None


# ---- Enrich episodes ------------------------------------------------------

def spotify_search(title: str) -> str:
    q = urllib.parse.quote(f"The Rest Is History {title}")
    return f"https://open.spotify.com/search/{q}"

def apple_search(title: str) -> str:
    q = urllib.parse.quote(f"The Rest Is History {title}")
    return f"https://podcasts.apple.com/us/podcast/the-rest-is-history/id1537788786"

def clean_title(title: str) -> str:
    m = re.match(r'^\s*\d+[\.:\)]\s*(.*)$', title)
    return m.group(1).strip() if m else title.strip()

def format_date(iso: str) -> str:
    if not iso:
        return ""
    try:
        return datetime.fromisoformat(iso).strftime("%Y-%m-%d")
    except Exception:
        return iso[:10]

def year_label(a: int, b: int) -> str:
    if a == 0 and b == 0:
        return "Undated"
    def fmt(y):
        if y < 0:
            return f"{-y} BCE"
        return str(y)
    if a == b:
        return fmt(a)
    return f"{fmt(a)} – {fmt(b)}"

enriched = []
for ep in eps:
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
    ep["apple_url"] = apple_search(ep["title"])
    # Slug for URLs
    slug = re.sub(r'[^a-z0-9]+', '-', ep["title"].lower()).strip('-')
    ep["slug"] = slug[:80]
    enriched.append(ep)

# ---- Build series index ---------------------------------------------------
series_map = defaultdict(list)
for ep in enriched:
    if ep["series_key"]:
        series_map[ep["series_key"]].append(ep)

# Only keep series with >=2 parts
real_series = {k: sorted(v, key=lambda e: e["part_number"] or 0)
               for k, v in series_map.items() if len(v) >= 2}
print(f"Real multi-part series: {len(real_series)}")

# Add series_key back onto singletons
for ep in enriched:
    if ep["series_key"] and ep["series_key"] not in real_series:
        ep["series_key"] = ""
        ep["part_number"] = None

# ---- Build thematic playlists --------------------------------------------
# Chronologically sorted within each playlist by (primary_start_year, pubdate)

def sort_key(ep):
    y = ep.get("primary_start_year") or 0
    return (y, ep["pubdate"])

def by_predicate(name, description, predicate, sort_by=sort_key):
    matched = [ep for ep in enriched if predicate(ep)]
    return {
        "name": name,
        "description": description,
        "count": len(matched),
        "episode_guids": [ep["guid"] for ep in sorted(matched, key=sort_by)],
    }

playlists = []

# --- Era playlists
era_defs = [
    ("Ancient World", "Bronze Age, Greece, Rome, Persia — the ancient Mediterranean and beyond.", "Ancient"),
    ("The Medieval World", "Byzantium, the Crusades, kings, plagues, and the Middle Ages.", "Medieval"),
    ("Early Modern", "Tudors, Reformation, exploration, and the age of revolutions (1500–1800).", "Early Modern"),
    ("The Long 19th Century", "Napoleon to the eve of WWI — the century that made the modern world.", "Long 19th Century"),
    ("World Wars & Interwar", "1914 to 1945 — total war, revolution, and the age of ideology.", "World Wars & Interwar"),
    ("The Postwar World", "Cold War, decolonisation, and the 20th century's second half.", "Postwar"),
    ("Contemporary History", "1991 to today — from the end of the Cold War to now.", "Contemporary"),
    ("Prehistory & Deep Past", "Before writing — origins, myths, and the earliest civilisations.", "Prehistory"),
]
for name, desc, era in era_defs:
    playlists.append(by_predicate(name, desc, lambda e, era=era: e.get("era_bucket") == era))

# --- Signature: your 1800–1934 focus playlist
playlists.append(by_predicate(
    "The Long 1800–1934",
    "The stretch from Napoleon's rise to the eve of WWII — Zack's signature deep dive.",
    lambda e: e.get("is_strongly_1800_1934"),
))

# --- Region playlists (only regions with enough episodes)
region_counter = Counter(e.get("primary_region") for e in enriched)
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
for region, desc in region_labels.items():
    if region_counter[region] >= 5:
        playlists.append(by_predicate(
            f"{region}",
            desc,
            lambda e, r=region: e.get("primary_region") == r,
        ))

# --- Theme playlists
theme_defs = [
    ("War & Battles", "From Marathon to the Marne — the great battles and wars.", "War & Military"),
    ("Kings & Queens", "Monarchy in all its forms: divine right to constitutional.", "Monarchy & Royalty"),
    ("Revolutions", "Every revolution the show has covered — French, Russian, American, and more.", "Revolution"),
    ("Empires", "Rise, expansion, and collapse of empires across the ages.", "Empire & Colonialism"),
    ("Assassinations & Regicide", "Killings that changed history.", "Assassination"),
    ("Sex, Scandal & Society", "The gossipy, salacious side of the past.", "Sex & Scandal"),
    ("Crime & Mystery", "Historical whodunits, cold cases, and unsolved mysteries.", "Crime & Mystery"),
    ("Religion & Belief", "Faith, church, heresy, and the sacred.", "Religion & Church"),
    ("Culture & Arts", "Painters, poets, playwrights, and the world they made.", "Culture & Arts"),
    ("Literature", "Great writers and the books that shaped their times.", "Literature"),
    ("Science & Discovery", "Big ideas, inventors, and scientific revolutions.", "Science & Technology"),
    ("Espionage", "Spies, secrets, and covert operations through history.", "Espionage"),
    ("Ideology & Politics", "Isms, movements, and the political imagination.", "Ideology"),
    ("Slavery", "The history of slavery and its abolition.", "Slavery"),
    ("Disaster & Plague", "Natural and human-made catastrophes.", "Disaster & Plague"),
    ("Sport & Games", "From Olympia to the modern stadium.", "Sport"),
    ("Music", "Great composers, movements, and moments in music history.", "Music"),
    ("Biography", "Deep-dive lives of individual historical figures.", "Biography"),
    ("Exploration & Discovery", "Explorers, expeditions, and encounters.", "Exploration & Discovery"),
    ("Genocide & Atrocity", "Confronting the darkest chapters.", "Genocide & Atrocity"),
]
for name, desc, theme in theme_defs:
    playlists.append(by_predicate(
        name,
        desc,
        lambda e, t=theme: t in (e.get("themes") or []),
    ))

# --- Curated cross-cutting playlists
playlists.append(by_predicate(
    "The World Wars",
    "The First and Second World Wars in depth.",
    lambda e: (e.get("era_bucket") == "World Wars & Interwar"
               and "War & Military" in (e.get("themes") or [])),
))

playlists.append(by_predicate(
    "Roman History",
    "Republic, empire, emperors, and the fall of Rome.",
    lambda e: (e.get("primary_region") in ("Italy", "Mediterranean")
               and (e.get("primary_start_year") or 0) < 500
               and (e.get("primary_start_year") or 0) > -800),
))

playlists.append(by_predicate(
    "Tudors & Stuarts",
    "England from Henry VII to the Glorious Revolution (1485–1714).",
    lambda e: (e.get("primary_region") == "Britain"
               and 1400 <= (e.get("primary_start_year") or 0) <= 1714),
))

playlists.append(by_predicate(
    "The Napoleonic Age",
    "From the French Revolution's radical phase to Waterloo (1789–1815).",
    lambda e: 1789 <= (e.get("primary_start_year") or 0) <= 1815,
))

playlists.append(by_predicate(
    "American Civil War Era",
    "The road to war, the war itself, and Reconstruction.",
    lambda e: (e.get("primary_region") == "United States"
               and 1840 <= (e.get("primary_start_year") or 0) <= 1880),
))

playlists.append(by_predicate(
    "The 1960s",
    "Protest, politics, culture, and Cold War flashpoints in the 60s.",
    lambda e: 1960 <= (e.get("primary_start_year") or 0) <= 1970),
)

playlists.append(by_predicate(
    "Cold War Flashpoints",
    "Crises, coups, and confrontations 1945–1991.",
    lambda e: (e.get("era_bucket") == "Postwar"
               and any(t in (e.get("themes") or [])
                       for t in ["War & Military", "Diplomacy", "Espionage", "Politics & Power"])),
))

# Filter out empty playlists and add ids
playlists = [p for p in playlists if p["count"] > 0]
for i, p in enumerate(playlists):
    p["id"] = re.sub(r'[^a-z0-9]+', '-', p["name"].lower()).strip('-')
    p["spotify_search_url"] = f"https://open.spotify.com/search/{urllib.parse.quote('The Rest Is History ' + p['name'])}"

# ---- Stats ---------------------------------------------------------------
themes_flat = Counter()
for e in enriched:
    for t in (e.get("themes") or []):
        themes_flat[t] += 1

stats = {
    "total_episodes": len(enriched),
    "date_range": [enriched[0]["pubdate_short"], enriched[-1]["pubdate_short"]],
    "eras": dict(Counter(e.get("era_bucket") for e in enriched).most_common()),
    "regions": dict(Counter(e.get("primary_region") for e in enriched).most_common(20)),
    "themes": dict(themes_flat.most_common(30)),
    "confidence": dict(Counter(e.get("confidence") for e in enriched).most_common()),
    "num_series": len(real_series),
    "num_playlists": len(playlists),
    "num_1800_1934": sum(1 for e in enriched if e.get("is_strongly_1800_1934")),
    "generated_at": datetime.utcnow().isoformat() + "Z",
}

# ---- Write out ----
# Slim episode records for the web app
FIELDS = [
    "guid", "episode_number", "title", "display_title", "description", "pubdate",
    "pubdate_short", "duration", "audio_url", "link", "slug",
    "primary_start_year", "primary_end_year", "year_label", "primary_region",
    "era_bucket", "themes", "key_figures", "is_series", "series_key",
    "series_name", "part_number", "is_strongly_1800_1934", "confidence",
    "reasoning", "spotify_search_url", "apple_url",
]
slim_eps = [{k: e.get(k) for k in FIELDS} for e in enriched]

OUT_EPS.write_text(json.dumps(slim_eps, ensure_ascii=False))
OUT_PLAYLISTS.write_text(json.dumps(playlists, ensure_ascii=False, indent=2))
OUT_STATS.write_text(json.dumps(stats, ensure_ascii=False, indent=2))

print(f"episodes_final.json: {OUT_EPS.stat().st_size:,} bytes, {len(slim_eps)} episodes")
print(f"playlists.json:      {OUT_PLAYLISTS.stat().st_size:,} bytes, {len(playlists)} playlists")
print(f"stats.json:          {OUT_STATS.stat().st_size:,} bytes")
print(f"\nMulti-part series:   {len(real_series)}")
print("\nSample playlists:")
for p in playlists[:15]:
    print(f"  [{p['count']:3d}] {p['name']}")
print("...")
for p in playlists[-5:]:
    print(f"  [{p['count']:3d}] {p['name']}")
