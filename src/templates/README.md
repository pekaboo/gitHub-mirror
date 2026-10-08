# __REPO_NAME__

Mirror of [__UPSTREAM_SLUG__](__UPSTREAM_URL__), kept in sync by GitHub Actions.

## How it works

The workflow at `.github/workflows/sync-repo.yml`:

1. Clones the upstream repo
2. Force-overwrites this repo's `main` branch content with upstream
   (`.github/` is preserved so the workflow itself survives)
3. Force-pushes to `main`

Trigger: manual only — Actions → **Sync from upstream** → Run workflow.

To switch upstream, set the `UPSTREAM_REPO` repo variable
(Settings → Secrets and variables → Actions → Variables), or edit the
fallback value in the workflow file.

---

Scaffolded by `github-mirror`.
