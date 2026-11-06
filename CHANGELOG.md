# Changelog

## 3.0.0

- Rename project and skill to `mandordantukangv3`.
- Any-CLI panes: decoupled squad roles from specific agent binaries; panes identified by title tags.
- Profile split: extracted personal communication style, shell prefixes, and project release procedures into gitignored `profile.local.md` with `profile.example.md` template.
- Depersonalized documentation: removed all private user names, individual projects, and hardcoded local environments from shared rules and guides.
- Per-CLI global rules: streamlined installer rule markers and skill links.
- Queue flush: restricted Alt+M (`\033m`) queue flushing specifically to agy panes.
- Usage tracking optional: CLIs without token parsing report usage as unavailable without error.
