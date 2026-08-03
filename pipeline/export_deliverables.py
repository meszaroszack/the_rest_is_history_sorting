"""Export user-facing deliverables:
- episodes.jsonl (one JSON object per line, EXACT schema from user's original prompt)
- episodes.csv (spreadsheet-friendly, all fields)
- episodes_extended.jsonl (all fields including our added categories)
"""
import csv
import json
from pathlib import Path

RD = Path("/home/user/workspace/rih")
eps = json.loads((RD / "episodes_final.json").read_text())

# --- 1. User's original exact-schema JSONL
out_orig = RD / "episodes.jsonl"
with out_orig.open("w") as f:
    for e in eps:
        row = {
            "title": e["title"],
            "primary_start_year": e.get("primary_start_year", 0) or 0,
            "primary_end_year": e.get("primary_end_year", 0) or 0,
            "primary_region": e.get("primary_region", "") or "",
            "is_strongly_1800_1934": bool(e.get("is_strongly_1800_1934")),
            "reasoning": e.get("reasoning", "") or "",
        }
        f.write(json.dumps(row, ensure_ascii=False) + "\n")

# --- 2. Extended JSONL with all our categorizations
out_ext = RD / "episodes_extended.jsonl"
with out_ext.open("w") as f:
    for e in eps:
        f.write(json.dumps(e, ensure_ascii=False) + "\n")

# --- 3. CSV
out_csv = RD / "episodes.csv"
fields = [
    "episode_number", "title", "pubdate_short", "primary_start_year",
    "primary_end_year", "year_label", "primary_region", "era_bucket",
    "themes", "key_figures", "is_series", "series_key", "part_number",
    "is_strongly_1800_1934", "confidence", "reasoning", "duration",
    "audio_url", "spotify_search_url", "guid",
]
with out_csv.open("w", newline="") as f:
    w = csv.writer(f)
    w.writerow(fields)
    for e in eps:
        row = []
        for k in fields:
            v = e.get(k, "")
            if isinstance(v, list):
                v = "; ".join(str(x) for x in v)
            elif isinstance(v, bool):
                v = "true" if v else "false"
            elif v is None:
                v = ""
            row.append(v)
        w.writerow(row)

print(f"episodes.jsonl:          {out_orig.stat().st_size:,} bytes, {len(eps)} rows")
print(f"episodes_extended.jsonl: {out_ext.stat().st_size:,} bytes")
print(f"episodes.csv:            {out_csv.stat().st_size:,} bytes")
