"""Fetch supplementary sources that complement the RSS feed:

- Live upcoming shows from therestishistory.com
- YouTube channel videos (public RSS, no API key required)
- Rest Is History Club membership metadata (from the public marketing pages)

All three are idempotent, best-effort — a failure in any one degrades gracefully
to "no data" rather than crashing the caller. Called from incremental_update.py
on every scheduled run.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

# YouTube channel: @restishistorypod
YOUTUBE_CHANNEL_ID = "UCUYK0BJZF3yNb2fw1EdAXUQ"
YOUTUBE_FEED_URL = f"https://www.youtube.com/feeds/videos.xml?channel_id={YOUTUBE_CHANNEL_ID}"
LIVE_EVENTS_URL = "https://therestishistory.com/events"
CLUB_URL = "https://therestishistory.com/club"

UA = "rih-atlas/1.0 (+https://github.com/meszaroszack/the_rest_is_history_sorting)"


def _fetch(url: str, timeout: int = 30) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")


# ---- Live events ---------------------------------------------------------

_MONTHS = {
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
}
_DATE_RE = re.compile(
    r"(?:Mon|Tues?|Wed(?:nes)?|Thur?s?|Fri|Sat(?:ur)?|Sun)(?:day)?\s+"
    r"(\d{1,2})(?:st|nd|rd|th)?\s+"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
    r"(\d{4})",
    re.IGNORECASE,
)


def _clean_text(html: str) -> str:
    html = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", unescape(txt)).strip()


def fetch_live_events() -> list[dict]:
    """Return a list of {name, date_iso, date_display, venue, link, cta} dicts,
    filtered to future events only.

    We parse the events page as text — the site's markup is minified React
    hydration output so anchor URLs aren't in the initial HTML. We match
    date patterns and take a fixed window of preceding text as the event name.
    """
    try:
        html = _fetch(LIVE_EVENTS_URL, timeout=20)
    except Exception as e:
        print(f"[live] fetch failed: {e}", file=sys.stderr)
        return []

    text = _clean_text(html)

    # Focus on the "Join us live" / "Live shows" region
    m = re.search(r"(?:Join us live|Live shows and events)(.+?)(?:Become a member|Tom and Dominic on the road|newsletter|Follow us)", text, re.IGNORECASE)
    region = m.group(1) if m else text

    events: list[dict] = []
    today = datetime.now(timezone.utc).date()
    for match in _DATE_RE.finditer(region):
        day = int(match.group(1))
        month = _MONTHS[match.group(2).title()]
        year = int(match.group(3))
        try:
            d = datetime(year, month, day, tzinfo=timezone.utc).date()
        except ValueError:
            continue
        if d < today:
            continue
        # Event name = the text immediately before the date (last ~140 chars, stopping at prior date)
        pre = region[: match.start()].strip()
        # Drop everything before the previous date match
        prev_dates = list(_DATE_RE.finditer(pre))
        if prev_dates:
            pre = pre[prev_dates[-1].end():].strip()
        # Also trim CSS-junk-looking tokens ("p]:text-lg", "[&>p]:...")
        pre_tokens = [t for t in pre.split() if not re.match(r"^[\[\&\]\|\*a-z\-]+[\]:>][^A-Z ]*$", t)]
        pre_clean = " ".join(pre_tokens).strip()
        # Drop leading "More info" or "Tickets" that belong to a previous card
        pre_clean = re.sub(r"^(?:More info\.?|Tickets)\s*", "", pre_clean, flags=re.IGNORECASE).strip()
        # Take the last ~90 chars as the event name — most cards are 40-70 chars
        name = pre_clean[-140:].strip(" .:-")
        # If we can find a venue-like phrase in the name, split
        venue = ""
        if ":" in name:
            head, tail = name.rsplit(":", 1)
            venue = tail.strip()
            name = head.strip()
        # CTA — look at what comes after the date
        post = region[match.end(): match.end() + 60].strip()
        cta = "Tickets" if re.match(r"^Tickets", post, re.IGNORECASE) else "More info"

        events.append({
            "name": name,
            "date_iso": d.isoformat(),
            "date_display": d.strftime("%a %b %d, %Y").replace(" 0", " "),
            "venue": venue,
            "cta": cta,
            "link": LIVE_EVENTS_URL,
        })

    # Deduplicate identical (name, date) pairs
    seen = set()
    unique = []
    for e in events:
        key = (e["name"], e["date_iso"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(e)

    unique.sort(key=lambda e: e["date_iso"])
    print(f"[live] {len(unique)} upcoming events")
    return unique


# ---- YouTube -------------------------------------------------------------

def _yt_slug(title: str) -> str:
    """Normalize a title for fuzzy matching to podcast episode titles."""
    t = title.lower()
    t = re.sub(r"\bpart\s+(\d+)\b", r"pt\1", t)
    t = re.sub(r"\bep\s*(\d+)\b", r"pt\1", t)
    t = re.sub(r"\bepisode\s+(\d+)\b", r"pt\1", t)
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return " ".join(t.split())


def fetch_youtube_videos() -> list[dict]:
    """Return list of {video_id, url, title, published, slug} — most recent first.
    YouTube's channel RSS returns 15 items."""
    try:
        raw = _fetch(YOUTUBE_FEED_URL, timeout=20)
    except Exception as e:
        print(f"[youtube] fetch failed: {e}", file=sys.stderr)
        return []

    try:
        root = ET.fromstring(raw)
    except ET.ParseError as e:
        print(f"[youtube] parse failed: {e}", file=sys.stderr)
        return []

    ns = {
        "atom": "http://www.w3.org/2005/Atom",
        "yt": "http://www.youtube.com/xml/schemas/2015",
        "media": "http://search.yahoo.com/mrss/",
    }
    videos = []
    for entry in root.findall("atom:entry", ns):
        vid = entry.findtext("yt:videoId", namespaces=ns) or ""
        title = (entry.findtext("atom:title", namespaces=ns) or "").strip()
        published = entry.findtext("atom:published", namespaces=ns) or ""
        thumb_el = entry.find(".//media:thumbnail", ns)
        thumb = thumb_el.get("url") if thumb_el is not None else ""
        if not vid or not title:
            continue
        videos.append({
            "video_id": vid,
            "url": f"https://www.youtube.com/watch?v={vid}",
            "title": title,
            "published": published[:10],
            "thumbnail": thumb or f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
            "slug": _yt_slug(title),
        })
    print(f"[youtube] {len(videos)} videos")
    return videos


# ---- Match YouTube videos to podcast episodes ----------------------------

def match_videos_to_episodes(videos: list[dict], episodes: list[dict]) -> dict[str, dict]:
    """Return {episode_guid: matched_video_dict}.

    Strategy: build a token set from each podcast episode title (using the same
    _yt_slug normalization). A YouTube video matches iff its slug shares at
    least 3 significant tokens with the episode slug AND the Jaccard overlap
    on non-stopword tokens is >= 0.35. Prefer the most recent matching video.
    """
    stop = {"the", "of", "and", "a", "an", "to", "in", "on", "at", "for", "with", "how", "why",
            "what", "is", "was", "were", "did", "do", "does", "part", "pt", "ep", "episode",
            "rest", "history", "podcast"}

    def toks(slug: str) -> set:
        return {t for t in slug.split() if t and t not in stop and len(t) > 2}

    ep_index = []
    for ep in episodes:
        ep_slug = _yt_slug(ep.get("title", ""))
        ep_index.append((ep["guid"], ep_slug, toks(ep_slug)))

    matches: dict[str, dict] = {}
    for v in videos:
        v_tokens = toks(v["slug"])
        if len(v_tokens) < 2:
            continue
        best_guid = None
        best_score = 0.0
        for guid, _, e_tokens in ep_index:
            if len(e_tokens) < 2:
                continue
            inter = v_tokens & e_tokens
            if len(inter) < 2:
                continue
            union = v_tokens | e_tokens
            jaccard = len(inter) / len(union) if union else 0.0
            # Also require a significant fraction of the video's meaningful tokens
            # to appear in the episode, so short/generic YT titles don't match everything.
            coverage = len(inter) / len(v_tokens) if v_tokens else 0.0
            score = jaccard * 0.6 + coverage * 0.4
            if score >= 0.45 and score > best_score:
                best_score = score
                best_guid = guid
        if best_guid:
            # Only overwrite if newer or first
            existing = matches.get(best_guid)
            if not existing or v["published"] > existing["published"]:
                matches[best_guid] = {**v, "match_score": round(best_score, 3)}

    print(f"[match] {len(matches)} episodes matched to YouTube videos")
    return matches


# ---- Club membership metadata -------------------------------------------

def fetch_club_meta() -> dict:
    """Return {benefits: [str], monthly_price_display: str, yearly_price_display: str,
    signup_url, festival: {...} | None, last_updated}."""
    try:
        html = _fetch(CLUB_URL, timeout=20)
    except Exception as e:
        print(f"[club] fetch failed: {e}", file=sys.stderr)
        return _default_club_meta()

    text = _clean_text(html)

    # Look for prices anywhere on the page (Apple lists $9.99/mo, $99.99/yr in USD)
    monthly = ""
    yearly = ""
    m = re.search(r"(\$|£|€)\s?(\d+(?:[.,]\d{2})?)\s*/?\s*(?:mo(?:nth)?|per month)", text, re.IGNORECASE)
    if m:
        monthly = f"{m.group(1)}{m.group(2)}/mo"
    m = re.search(r"(\$|£|€)\s?(\d+(?:[.,]\d{2})?)\s*/?\s*(?:yr|year|annually|per year)", text, re.IGNORECASE)
    if m:
        yearly = f"{m.group(1)}{m.group(2)}/yr"

    benefits = [
        "Weekly bonus episodes",
        "Ad-free listening",
        "Full series released in one drop",
        "Early access to live show tickets",
        "Members-only Discord community",
    ]

    return {
        "benefits": benefits,
        "monthly_price_display": monthly or "Check site for price",
        "yearly_price_display": yearly,
        "signup_url": CLUB_URL,
        "site_url": "https://therestishistory.com",
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


def _default_club_meta() -> dict:
    return {
        "benefits": [
            "Weekly bonus episodes",
            "Ad-free listening",
            "Full series released in one drop",
            "Early access to live show tickets",
            "Members-only Discord community",
        ],
        "monthly_price_display": "Check site for price",
        "yearly_price_display": "",
        "signup_url": CLUB_URL,
        "site_url": "https://therestishistory.com",
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


# ---- Public entry point --------------------------------------------------

def fetch_all(episodes: list[dict] | None = None) -> dict:
    """Fetch all extras. If episodes is provided, also produce YouTube matches."""
    extras = {
        "live_events": fetch_live_events(),
        "youtube_latest": fetch_youtube_videos(),
        "club": fetch_club_meta(),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    if episodes:
        extras["youtube_matches"] = match_videos_to_episodes(extras["youtube_latest"], episodes)
    return extras


if __name__ == "__main__":
    # Standalone test / manual run
    result = fetch_all()
    print(json.dumps(result, indent=2))
