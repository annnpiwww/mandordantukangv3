# User Profile Template (profile.example.md)

Copy this file to `profile.local.md` in your `$MANDOR_HOME` directory (or repo root) to set your personal preferences.
`profile.local.md` is gitignored and will never be committed to shared repositories.

## 1. User Communication Style
Configure how Mandor communicates with you. (Default across the squad is concise English if not configured).

Example profile:
- Language: Indonesian casual Gen-Z / natural tone (`humanizer-indonesia` style)
- Output format: Caveman ultra (ultra-concise, maximum 3-4 bullet points, under 50 words)
- Style: Direct and factual; report what was done, real test results, and any blockers; no narration or conversational filler
- Punctuation: Standard ASCII hyphens and punctuation; no unicode em dashes or en dashes

## 2. Terminal and Shell Conventions
Define command prefixes and execution preferences for all workers:
- Command prefix: `rtk` (e.g. `rtk git status`, `rtk npm test`)
- Code search: semantic search first (`xerj def "<symbol>"`, `semantex --refs "<query>"`), grep only for literal strings
- Foreground execution: long builds and test suites run in foreground with timeout (e.g. `timeout 1500 <cmd>`), no polling loops

## 3. Project Release Steps (Example)
Customize project-specific release workflows for Tukang Coder:

```bash
# Example project release sequence:
# 1. Update version number and changelog
#    npm version patch  # or bump pubspec.yaml / Cargo.toml
#
# 2. Run test suites and static analysis in foreground
#    npm test
#    npm run lint
#
# 3. Build release package in foreground
#    npm run build
#
# 4. Verify artifact integrity
#    sha256sum dist/*
#
# 5. Optional notification / deployment step
#    # ./scripts/notify-release.sh dist/
```
