import { execFileSync } from 'node:child_process';

function sh(cmd, args, { cwd } = {}) {
  return execFileSync(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  }).trim();
}

export function hasBin(cmd) {
  try {
    sh('which', [cmd]);
    return true;
  } catch {
    return false;
  }
}

/** git init on branch `main` + initial commit. Falls back for git < 2.28. */
export function gitInit(dir, upstreamSlug) {
  const run = (args) => sh('git', args, { cwd: dir });
  try {
    run(['init', '-b', 'main']);
  } catch {
    run(['init']);
    run(['checkout', '-b', 'main']);
  }

  // Commit fails without an identity; fall back to a local bot identity.
  let email = '';
  try {
    email = sh('git', ['config', 'user.email']);
  } catch {
    /* not configured anywhere */
  }
  if (!email) {
    run(['config', '--local', 'user.name', 'github-mirror']);
    run(['config', '--local', 'user.email', 'github-mirror@users.noreply.github.com']);
  }

  run(['add', '-A']);
  run(['commit', '-m', `chore: init mirror of ${upstreamSlug} (via github-mirror)`]);
}

/**
 * Creates the GitHub repo under the active `gh` account and pushes.
 * @returns {string} created repo URL
 */
export function createRemoteAndPush(dir, { name, visibility }) {
  if (!/^[\w][\w.-]*$/.test(name)) {
    throw new Error(`Invalid repository name: ${name}`);
  }

  // Route this repo's git auth through gh's active account, ignoring any
  // stale global credential helpers (empty value resets the helper list).
  sh('git', ['config', '--local', 'credential.helper', ''], { cwd: dir });
  sh('git', ['config', '--local', 'credential.helper', '!gh auth git-credential'], { cwd: dir });

  const out = sh('gh', [
    'repo',
    'create',
    name,
    `--${visibility}`,
    '--source',
    '.',
    '--remote',
    'origin',
    '--push',
  ], { cwd: dir });

  const url = (out.match(/https:\/\/github\.com\/\S+/) || [])[0];
  return url || out;
}
