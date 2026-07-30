# Media replacement guide

- `hero-video.webm` is the active looping Hero background video.
- `section-scroll-video.mp4` is the active scroll-scrub asset, driven by direct `video.currentTime` mapping from a Blob URL (rockstargames.com/VI scrollmation recipe). Replacements MUST be re-encoded with: H.264 (libx264), faststart, no B-frames (`-bf 0`), keyframe every 2 frames (`-g 2 -keyint_min 2 -sc_threshold 0`), yuv420p, no audio. See `AGENT_HANDOFF.md` section 7 for the exact ffmpeg command.
- Hero 当前不使用静态 poster；如后续需要，可在 `src/data/site.ts` 中重新配置。
- Replace project SVG files through the corresponding entries in `src/data/projects.ts`.
- Keep all interface text in HTML; media should not contain required UI copy.
