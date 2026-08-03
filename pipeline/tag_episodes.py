"""Tag The Rest Is History episodes with historical period + rich categorization.

Uses pplx_sdk.llm with a checkpointed batched fanout so a 300s bash() window
covers ~120 rows and re-runs skip completed batches.
"""
import asyncio
import hashlib
import json
import os
from pathlib import Path

import pplx_sdk
from pplx_sdk import AsyncLlmApiClient
from pplx_sdk.utils import Checkpoint, fanout, read_jsonl, write_jsonl

RD = Path(os.environ.get("RD", "/home/user/workspace/rih"))
INPUT = RD / "episodes_raw.jsonl"
OUT_TAGGED = RD / "episodes_tagged.jsonl"

INSTRUCTION = """You are an expert historian tagging episodes of the popular podcast "The Rest Is History" (hosted by Tom Holland and Dominic Sandbrook).

For each episode, read the title and description and infer the primary historical period covered. Use ONLY information in the title and description; do not invent facts beyond what they support.

For each episode return the following fields:

1. primary_start_year (int): Start year of the main historical focus. Negative for BCE (e.g. -336 for Alexander the Great, -44 for Julius Caesar's death). Use 0 ONLY if the episode is genuinely undated/purely thematic (like "why history matters", "how we make the show", trailers, live-show announcements).

2. primary_end_year (int): End year of the main historical focus. Same rules.

3. primary_region (string): Short region label. Use one of: "Britain", "Ireland", "France", "Germany", "Italy", "Spain", "Netherlands", "Scandinavia", "Russia", "Eastern Europe", "Europe", "United States", "Latin America", "Africa", "Middle East", "India", "China", "Japan", "Southeast Asia", "Central Asia", "Oceania", "Global", "Mediterranean", "Byzantine", "Ancient Near East", "Undated". Pick the single most dominant region.

4. era_bucket (string): One of "Prehistory" (before -3000), "Ancient" (-3000 to 500), "Medieval" (500-1500), "Early Modern" (1500-1800), "Long 19th Century" (1800-1914), "World Wars & Interwar" (1914-1945), "Postwar" (1945-1991), "Contemporary" (1991-present), "Undated".

5. themes (array of strings): 1-4 tags from this fixed vocabulary:
   ["War & Military", "Politics & Power", "Monarchy & Royalty", "Religion & Church", "Revolution", "Empire & Colonialism", "Exploration & Discovery", "Science & Technology", "Culture & Arts", "Literature", "Music", "Sport", "Crime & Mystery", "Sex & Scandal", "Disaster & Plague", "Economics & Trade", "Assassination", "Espionage", "Slavery", "Genocide & Atrocity", "Biography", "Ideology", "Diplomacy", "Meta/Podcast"]

6. key_figures (array of strings): Named historical people the episode is primarily ABOUT (not incidental mentions). Empty array if none. Max 5.

7. is_series (boolean): True if title contains "Part N" or "(Part N)" or similar multi-part indicator.

8. series_name (string): If is_series, the series title without the part suffix (e.g. "Joan of Arc", "The First World War", "Revolution in Iran: Fall of the Shah"). Empty string otherwise.

9. is_strongly_1800_1934 (boolean): True IFF the dominant historical focus lies BETWEEN 1800 and 1934 inclusive. False for undated, ancient, medieval, early modern (pre-1800), or post-1934 topics. If an episode's dominant focus is a narrower 1800-1934 story even though it touches other eras, still true.

10. confidence (string): "high", "medium", or "low" — how confident are you in the date range given the description?

11. reasoning (string): 1-2 sentences citing specific phrases from the description that anchored your dating (e.g. "described as 'the First World War'", "mentions Napoleon at Austerlitz 1805", "titled 'Julius Caesar's assassination'").

Edge cases:
- Biographies: use the years of the central events, not the whole lifespan, unless the description clearly covers the entire life.
- Multi-era episodes: pick the era that gets the most narrative detail.
- Live show announcements, meta episodes, trailers, or "introducing X" cross-promo: era_bucket="Undated", years=0/0.
- Ancient/BCE: use negative integers (e.g. -753 for founding of Rome).
- Round century-scale spans: it's fine to give (1750, 1815) or (1914, 1918) — don't over-narrow.
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
        "primary_start_year",
        "primary_end_year",
        "primary_region",
        "era_bucket",
        "themes",
        "is_series",
        "is_strongly_1800_1934",
        "reasoning",
    ],
}

BATCH = 8
CONCURRENCY = 4
MAX_TOKENS = 16384


def _digest(payload):
    return hashlib.md5(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()[:8]


def make_row_input(ep):
    """Slim, LLM-facing view of an episode."""
    desc = ep["description"] or ""
    if len(desc) > 2500:
        desc = desc[:2500] + "…"
    return {
        "guid": ep["guid"],
        "title": ep["title"],
        "description": desc,
    }


def main():
    rows_full = read_jsonl(INPUT)
    print(f"Loaded {len(rows_full)} episodes from {INPUT}")

    ck = Checkpoint(RD / "tagger")
    llm = AsyncLlmApiClient()

    config = _digest([INSTRUCTION, SCHEMA, MAX_TOKENS, "v2"])

    slim = [make_row_input(ep) for ep in rows_full]
    batches = []
    for i in range(0, len(slim), BATCH):
        batch = slim[i : i + BATCH]
        batches.append({"key": f"{config}:{_digest(batch)}", "batch": batch})

    pending = [b for b in batches if not ck.has(b["key"])]
    print(f"Batches: {len(batches)} total, {len(pending)} pending")

    async def process(*, key, batch):
        items = [json.dumps(r) for r in batch]
        results = await llm.extract(
            items=items,
            instruction=INSTRUCTION,
            output_schema=SCHEMA,
            max_tokens=MAX_TOKENS,
        )
        out = []
        for row, r in zip(batch, results, strict=True):
            if r.error is not None:
                out.append({**row, "ok": False, "error": r.error.to_dict()})
            else:
                extracted = r.result or {}
                out.append({**row, **extracted, "ok": True})
        ck.record(key, out)

    async def runner():
        await fanout(process, pending, concurrency=CONCURRENCY)

    if pending:
        asyncio.run(runner())

    # Assemble final: merge tagged fields back into full episode rows
    by_guid = {}
    for r in ck.read_all():
        by_guid[r["guid"]] = r

    tagged = []
    for ep in rows_full:
        t = by_guid.get(ep["guid"], {})
        merged = {**ep}
        if t.get("ok"):
            for k in [
                "primary_start_year",
                "primary_end_year",
                "primary_region",
                "era_bucket",
                "themes",
                "key_figures",
                "is_series",
                "series_name",
                "is_strongly_1800_1934",
                "confidence",
                "reasoning",
            ]:
                if k in t:
                    merged[k] = t[k]
            merged["tag_ok"] = True
        else:
            merged["tag_ok"] = False
            merged["tag_error"] = t.get("error")
        tagged.append(merged)

    write_jsonl(OUT_TAGGED, tagged)
    ok = sum(1 for t in tagged if t.get("tag_ok"))
    print(f"Wrote {OUT_TAGGED}: {ok}/{len(tagged)} tagged OK")


if __name__ == "__main__":
    main()
