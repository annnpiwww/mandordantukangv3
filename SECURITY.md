# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue. Report privately via GitHub's
[private security advisory](https://github.com/annnpiwww/mandordantukangv3/security/advisories/new)
on `github.com/annnpiwww/mandordantukangv3`. Include the affected file/line, a
reproduction, and the impact you expect. You will get an acknowledgement and a
fix/coordination timeline in the advisory thread.

## Trust model

This project is a **local, single-user** orchestration tool. It is not a sandbox
and it is not a multi-tenant service.

- `orca-bridge` runs on your machine, in your shell, with **your** privileges.
  It drives Orca terminals through the `orca` CLI.
- A task spec (`task.json`) and its `verification_command` **execute as a shell
  command on the local machine** (`bash -c`, via `scripts/orca-bridge.sh`). A
  spec is trusted input: whoever can write the spec can run code as you. Task
  specs are authored by the Mandor agent, so treat a compromised Mandor — or a
  spec file from an untrusted source — as local code execution.
- Workers (Tukang UI / Coder / Security) are **LLM agents, not sandboxes**. They
  are bounded by `allowed_files` and the change-set check that the bridge
  re-runs at report time (`task check`). That bound is a **correctness /
  anti-drift guard**, enforced after the fact on the diff and on worker identity
  signals — it does not prevent a worker from reading files outside the
  allowlist, and it is not a containment boundary.
- There is no authentication between panes. Terminal identity comes from
  `ORCA_TERMINAL_HANDLE` / pair bindings / saved state, so any local process can
  claim a pane handle or call `orca-bridge task approve`. The gate protects you
  against mistakes and a bounded agent, not against a malicious process already
  running as you.
- If any of that is not acceptable: run the agents in a container or VM with a
  disposable checkout and no credentials in the environment.

## Known risks

Audited against the working tree on top of `9fda669` (`chore: import v2
baseline`); `scripts/`, `rules/` and `docs/` were mid-rebrand while auditing, so
line numbers can drift — each item names the function so it stays findable.
Findings are ranked, each with the exact location and a one-line mitigation.

### High

1. **Unpinned third-party skill clones (supply chain).**
   `scripts/install-skills.sh:11-17` — `clone()` does `git clone --depth 1` of six
   upstream repos (`jakubkrehel/skills`, `flutter/skills`,
   `deanpeters/Product-Manager-Skills`, `trailofbits/skills`,
   `mattpocock/skills`, `vercel-labs/web-interface-guidelines`) with no commit
   pin, and the cloned content is copied into `~/.agents/skills` (`:53`, `:60`)
   where agents then follow it as instructions. Whatever lands on the upstream
   default branch that day is executed as behaviour on your machine.
   *Mitigation:* pin each repo to a reviewed commit SHA, `git checkout <sha>`
   before copying, or vendor the skills in-tree.

### Medium

2. **Allowlist/scope check matches path strings only, never symlinks.**
   `scripts/mandor-lib.js:245-253` (`scope`) + `:52-60` (`normRelPath`) +
   `scripts/orca-bridge.sh:196-213` (`changed_shared`). A tracked symlink placed
   on an allowed path can be written through: the target outside the repo changes
   while the blob (the link itself) does not, so the diff shows **no change** and
   the scope check cannot see it.
   *Mitigation:* reject any changed/untracked path that is a symlink whose
   `realpath` leaves the repo root, before `task check` can pass.

3. **`task revert` writes blobs through symlinks.**
   `scripts/orca-bridge.sh:489-492` — `git cat-file blob "$b" > "$root/$f"` and
   `git show "$base:$f" > "$root/$f"` follow a symlink at `$f`, so a revert can
   overwrite a file outside the repo.
   *Mitigation:* unlink `$root/$f` (or write to a temp file and `mv` onto it)
   instead of redirecting into an existing inode.

4. **No caller authentication on report/approve.**
   `scripts/orca-bridge.sh:10` (`SELF_HANDLE` from env), `:680-682` (report
   identity), `:381-393` (`task_approve`). Any local process can export
   `ORCA_TERMINAL_HANDLE=<tukang handle>` and send a report, or call
   `task approve` directly; approval is gated by state, not by role.
   *Mitigation:* on `task approve`, refuse unless `SELF_HANDLE` equals the
   recorded `mandor_handle` (and document that this is still not authentication).

5. **Worker-controlled text is delivered to Mandor's terminal unescaped.**
   `scripts/orca-bridge.sh:666` (`summary="$*"`), `:698-718` (report formatting),
   `:126-129` (`deliver` with `--text "$3" --enter`). Newlines and control
   characters survive, so a report can forge extra lines such as a fake
   `[MANDOR TASK ...]` block or a terminal escape sequence in Mandor's pane.
   *Mitigation:* strip C0/C1 control bytes and collapse newlines in `summary`
   before `deliver`.

6. **`verification_command` is arbitrary shell, and can be auto-detected from the
   audited repo.** `scripts/orca-bridge.sh:159` and `:162` run
   `bash -c "$cmd"`; `:134-150` (`detect_verify`) will pick `npm test` /
   `make test` etc. from the target repo when the spec omits a command. By
   design, but it means a hostile repo (its test script) or a tampered spec runs
   code with your privileges, outside any allowlist.
   *Mitigation:* always set `verification_command` explicitly for third-party
   checkouts, and treat `--spec -` stdin as trusted input only.

### Low

7. **Unquoted array elements in the skill list.**
    `scripts/install-skills.sh:22-46` expands `$K/...`, `$F/...` unquoted, which
    works only because `mktemp -d` paths contain no spaces or glob characters.
    *Mitigation:* quote the array entries.

## Audit notes (secrets sweep)

Read-only sweep of `git ls-files` (48 tracked files) for credentials and
environment leakage:

- No API keys, tokens, bearer credentials, private-key blocks, passwords, or
  `AWS`-style key IDs found.
- No private IP addresses or internal hostnames; the only URLs are
  `http://localhost:9200` (xerj probe, `scripts/orca-pair.sh:66`) and
  `http://localhost:3999` (browser default, `scripts/orca-bridge.sh:887`).
- No absolute home paths or personal names (the test-fixture path and prompt
  strings flagged during the audit were rebranded before publishing).
- Identifier found: `annnpiwww` in `LICENSE:3` (intended, matches the public
  repo owner).
- `.gitignore` already excludes `.env*`, `*.pem`, `*.key`, `*.secret`,
  `id_rsa*`, `id_ed25519*`, logs, and local tool caches; the bridge additionally
  hashes (never copies) gitignored secret files for change detection
  (`scripts/orca-bridge.sh:185-192`).

`rm -rf` uses in `scripts/` are all `--`-terminated and target `mktemp` dirs,
lock dirs, or the task's own worktree (`scripts/orca-bridge.sh:15,91,763`,
`scripts/install.sh:107,125`, `scripts/install-skills.sh:8`); no user-supplied
path reaches an unguarded recursive delete.
