# Data

Shippable outputs of the pipeline. Regenerate with `pipeline/*.py`.

| File | Rows | Format | Use |
|---|---|---|---|
| `episodes.jsonl` | 713 | JSONL, exact original schema | The one you asked for — one JSON per line, only the fields from the original prompt (title, primary_start_year, primary_end_year, primary_region, is_strongly_1800_1934, reasoning). |
| `episodes_extended.jsonl` | 713 | JSONL, full schema | Every field including era_bucket, themes[], key_figures[], is_series, series_key, part_number, confidence, spotify_search_url, apple_url, audio_url. |
| `episodes.csv` | 713 | CSV | Same rows as `episodes_extended.jsonl`, spreadsheet-friendly. Multi-value fields (themes, key_figures) are joined with `; `. |
| `playlists.json` | 52 | JSON | Curated playlists with `episode_guids` in chronological order plus a Spotify search deep-link per playlist. |
| `stats.json` | 1 | JSON | Roll-up counts (era distribution, region distribution, theme frequency) used for the app's landing page. |

## Schema — `episodes.jsonl`

```json
{
  "title": "243. Trafalgar: A World at War (Part 1)",
  "primary_start_year": 1805,
  "primary_end_year": 1805,
  "primary_region": "Europe",
  "is_strongly_1800_1934": true,
  "reasoning": "The description explicitly identifies the Battle of Trafalgar, fought in 1805..."
}
```

## Schema — `episodes_extended.jsonl`

Every field in `episodes.jsonl` plus:

```
guid, episode_number, display_title, description, pubdate, pubdate_short, duration,
audio_url, link, slug, year_label, era_bucket, themes[], key_figures[], is_series,
series_key, part_number, confidence, spotify_search_url, apple_url
```

## Signature filter

`is_strongly_1800_1934 = true` on **141 episodes** — the "long 19th century into the early 20th" cohort emphasised in the original tagging prompt.
