# Pipeline

Scripts run in order:

1. `parse_feed.py` — RSS feed → normalized JSONL (713 rows)
2. `tag_episodes.py` — LLM-tag each episode (checkpointed; safe to re-run)
3. `postprocess.py` — Series detection + 52 playlists + Spotify/Apple links
4. `export_deliverables.py` — CSV + original-schema JSONL for `data/`
5. `inspect_tags.py` — Sanity prints (era distribution, region distribution, sample rows)

All scripts default to reading/writing under `../rih/` when run from this directory. Set `RD=/path/to/workdir` to override.

The tagger uses `pplx_sdk.llm.extract` for parallel LLM extraction. If you're running outside the Perplexity Computer environment, replace that call with any structured-output LLM — the JSON schema is provider-agnostic and the instruction is in-line.
