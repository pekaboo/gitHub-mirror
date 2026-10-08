# github-mirror

A CLI that scaffolds a GitHub repository which force-syncs from any upstream
repository via GitHub Actions.

```bash
github-mirror https://github.com/chenguangwu/chenguangwu.github.io
```

Creates a repo containing a manual-trigger workflow that clones the upstream,
force-overwrites `main` with its content, and force-pushes — the same battle-tested
workflow as [wang-neo/github-tool-box](https://github.com/wang-neo/github-tool-box).

## Install

```bash
git clone https://github.com/pekaboo/gitHub-mirror.git
cd gitHub-mirror
npm install
npm link          # exposes the global `github-mirror` command
```

## Requirements

- Node.js ≥ 18
- `git`
- `gh` (GitHub CLI) — optional, for one-shot remote creation + push

## Usage

```bash
github-mirror <repo> [options]
```

`<repo>` accepts any of:

- `https://github.com/owner/repo`
- `git@github.com:owner/repo`
- `owner/repo`

### Options

| Flag | Description |
| --- | --- |
| `-d, --dir <name>` | Target directory. Default: use the current directory if it is empty; otherwise prompt for a new directory name. |
| `--visibility <type>` | Remote repo visibility when creating: `private` (default) or `public`. |
| `-c, --create-remote` | Create the GitHub repo and push without prompting (for non-interactive sessions). |
| `--no-create` | Skip remote creation entirely. |
| `-V, --version` | Print version. |

### What it does

1. **Directory resolution** — empty cwd? Scaffolds in place. Non-empty? Asks for
   a new directory name (default suggestion `<repo>-mirror`) and creates it.
2. **Scaffold** — writes `.github/workflows/sync-repo.yml` (upstream URL baked in,
   overridable later via the `UPSTREAM_REPO` repo variable), `README.md`, `.gitignore`.
3. **Git** — `git init` on `main` + initial commit. If no git identity is configured,
   sets a local bot identity so the commit never fails.
4. **Remote (optional)** — creates the repo under the active `gh` account
   (default **private**) and pushes. The repo's local git auth is routed through
   `gh auth git-credential`, sidestepping stale global credential helpers.

### The generated workflow

- Trigger: manual only (Actions → **Sync from upstream** → Run workflow)
- Preserves `.github/` when overwriting, so the workflow never deletes itself
- `--force` push to `main`; skips empty commits; 15-minute job timeout;
  concurrency-guarded

## License

MIT
