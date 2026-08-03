"""Quick sanity checks on the tagged dataset."""
import json
from collections import Counter
from pathlib import Path

path = Path("/home/user/workspace/rih/episodes_tagged.jsonl")
eps = [json.loads(l) for l in path.read_text().splitlines()]

print(f"Total: {len(eps)}")
print(f"tag_ok: {sum(1 for e in eps if e.get('tag_ok'))}")
print()

# Era distribution
print("=== Era buckets ===")
for era, n in Counter(e.get("era_bucket", "?") for e in eps).most_common():
    print(f"  {n:4d}  {era}")

print()
print("=== 1800–1934 dominant ===")
n1800 = sum(1 for e in eps if e.get("is_strongly_1800_1934"))
print(f"  {n1800} episodes ({n1800/len(eps)*100:.1f}%)")

print()
print("=== Region top 15 ===")
for r, n in Counter(e.get("primary_region", "?") for e in eps).most_common(15):
    print(f"  {n:4d}  {r}")

print()
print("=== Theme frequency (top 20) ===")
theme_counter = Counter()
for e in eps:
    for t in e.get("themes", []) or []:
        theme_counter[t] += 1
for t, n in theme_counter.most_common(20):
    print(f"  {n:4d}  {t}")

print()
print("=== Confidence ===")
for c, n in Counter(e.get("confidence", "?") for e in eps).most_common():
    print(f"  {n:4d}  {c}")

print()
print("=== Sample: 5 random 1800–1934 episodes ===")
import random
random.seed(1)
s = [e for e in eps if e.get("is_strongly_1800_1934")]
for e in random.sample(s, min(5, len(s))):
    print(f"  [{e.get('primary_start_year')}–{e.get('primary_end_year')}] {e.get('primary_region'):20s} | {e['title'][:70]}")
    print(f"    themes: {e.get('themes')}")
    print(f"    reasoning: {e.get('reasoning', '')[:180]}")

print()
print("=== Sample: 5 random 'Ancient' episodes ===")
s = [e for e in eps if e.get("era_bucket") == "Ancient"]
for e in random.sample(s, min(5, len(s))):
    print(f"  [{e.get('primary_start_year')}–{e.get('primary_end_year')}] {e.get('primary_region'):20s} | {e['title'][:70]}")

print()
print("=== Sample: 5 random 'Undated' episodes ===")
s = [e for e in eps if e.get("era_bucket") == "Undated"]
for e in random.sample(s, min(5, len(s))):
    print(f"  {e['title'][:90]}")
    print(f"    reasoning: {e.get('reasoning', '')[:180]}")

print()
print("=== Multi-part series (top 20 by episode count) ===")
series = Counter(e.get("series_name", "") for e in eps if e.get("is_series") and e.get("series_name"))
for s, n in series.most_common(20):
    print(f"  {n:3d}  {s}")
