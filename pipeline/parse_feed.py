"""Parse The Rest Is History RSS feed into a normalized JSONL dataset."""
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from html import unescape

FEED = "/home/user/workspace/rih/feed.xml"
OUT_JSONL = "/home/user/workspace/rih/episodes_raw.jsonl"
OUT_JSON = "/home/user/workspace/rih/episodes_raw.json"

NS = {
    "itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "atom": "http://www.w3.org/2005/Atom",
}

tree = ET.parse(FEED)
root = tree.getroot()
channel = root.find("channel")

def strip_html(html: str) -> str:
    if not html:
        return ""
    txt = re.sub(r"<[^>]+>", " ", html)
    txt = unescape(txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt

def parse_pubdate(s: str) -> str:
    if not s:
        return ""
    try:
        return datetime.strptime(s, "%a, %d %b %Y %H:%M:%S %z").isoformat()
    except Exception:
        try:
            return datetime.strptime(s[:25], "%a, %d %b %Y %H:%M:%S").isoformat()
        except Exception:
            return s

episodes = []
for item in channel.findall("item"):
    title = (item.findtext("title") or "").strip()
    desc_html = item.findtext("description") or ""
    content_encoded = item.findtext("content:encoded", namespaces=NS) or ""
    itunes_summary = item.findtext("itunes:summary", namespaces=NS) or ""
    # Use the richest available
    best_html = max([desc_html, content_encoded, itunes_summary], key=len)
    description = strip_html(best_html)

    guid = (item.findtext("guid") or "").strip()
    pubdate = parse_pubdate(item.findtext("pubDate") or "")
    duration = item.findtext("itunes:duration", namespaces=NS) or ""
    ep_num = item.findtext("itunes:episode", namespaces=NS) or ""
    season = item.findtext("itunes:season", namespaces=NS) or ""
    ep_type = item.findtext("itunes:episodeType", namespaces=NS) or ""

    enclosure = item.find("enclosure")
    audio_url = enclosure.get("url") if enclosure is not None else ""

    link = item.findtext("link") or ""

    # Extract number prefix from title (e.g. "677. USA: ...")
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

# Sort chronologically ascending
episodes.sort(key=lambda e: e["pubdate"])

with open(OUT_JSONL, "w") as f:
    for e in episodes:
        f.write(json.dumps(e, ensure_ascii=False) + "\n")

with open(OUT_JSON, "w") as f:
    json.dump(episodes, f, ensure_ascii=False, indent=2)

print(f"Parsed {len(episodes)} episodes")
print(f"Date range: {episodes[0]['pubdate']} -> {episodes[-1]['pubdate']}")
print(f"Numbered episodes: {sum(1 for e in episodes if e['episode_number'])}")
print(f"Full-only episodes: {sum(1 for e in episodes if e['episode_type']=='full')}")
print("\nSample titles (first 5):")
for e in episodes[:5]:
    print(f"  {e['pubdate'][:10]} | {e['title'][:80]}")
print("\nSample titles (last 5):")
for e in episodes[-5:]:
    print(f"  {e['pubdate'][:10]} | {e['title'][:80]}")
print(f"\nAvg description length: {sum(len(e['description']) for e in episodes)/len(episodes):.0f} chars")
