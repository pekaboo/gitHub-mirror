// Normalizes the many ways users spell a GitHub repo into owner/repo + https URL.

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}[A-Za-z0-9])?$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

export function parseRepoUrl(input) {
  const s = String(input ?? '')
    .trim()
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');

  let m;
  if ((m = s.match(/^git@github\.com:([^/\s]+)\/([^/\s]+)$/))) {
    // ssh form
  } else if (
    (m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s?#]+)\/([^/\s?#]+)$/i))
  ) {
    // https form (scheme optional)
  } else if ((m = s.match(/^([^/\s]+)\/([^/\s]+)$/)) && !s.includes(':')) {
    // owner/repo shorthand
  } else {
    return {
      error:
        `Not a valid GitHub repository: "${input}"\n` +
        '  Expected: https://github.com/owner/repo, git@github.com:owner/repo, or owner/repo',
    };
  }

  const [, owner, repo] = m;
  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo) || repo.startsWith('.') || repo.endsWith('.lock')) {
    return { error: `Invalid GitHub repository name: "${owner}/${repo}"` };
  }

  return { owner, repo, slug: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}` };
}
