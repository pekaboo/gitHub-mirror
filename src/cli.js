import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { parseRepoUrl } from './validate.js';
import { scaffold } from './scaffold.js';
import { hasBin, gitInit, createRemoteAndPush } from './git.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const isInteractive = process.stdout.isTTY && process.stdin.isTTY;

const IGNORED_ENTRIES = new Set(['.DS_Store']);

function isEmptyDir(dir) {
  return fs
    .readdirSync(dir)
    .every((entry) => IGNORED_ENTRIES.has(entry));
}

/** `${repo}-mirror`, appending -2, -3… if the name is taken by a non-empty dir. */
function defaultDirName(repo, baseDir) {
  let name = `${repo}-mirror`;
  let n = 2;
  while (true) {
    const abs = path.join(baseDir, name);
    if (!fs.existsSync(abs) || isEmptyDir(abs)) return name;
    name = `${repo}-mirror-${n++}`;
  }
}

const DIR_NAME_RE = /^[\w][\w .-]*$/;

function fail(message, { hint } = {}) {
  p.log.error(pc.red(message));
  if (hint) p.log.message(pc.dim(`  hint: ${hint}`));
  p.outro('Aborted.');
  process.exit(1);
}

function cancelOut() {
  p.cancel('Cancelled.');
  process.exit(130);
}

function manualNextSteps(dir, created) {
  if (created) return; // remote flow already printed everything
  const rel = path.relative(process.cwd(), dir);
  const cd = rel && rel !== '.' ? `  ${pc.cyan(`cd ${rel}`)}\n` : '';
  p.log.message(
    `Next steps:\n` +
      cd +
      `  ${pc.cyan(`gh repo create <name> --private --source . --remote origin --push`)}`
  );
}

async function createRemote(dir, { name, visibility }) {
  const s = p.spinner();
  s.start(`Creating GitHub repo ${pc.bold(name)} (${visibility}) and pushing`);
  try {
    const url = createRemoteAndPush(dir, { name, visibility });
    s.stop(`Created and pushed: ${pc.cyan(url)}`);
    return url;
  } catch (err) {
    s.stop(pc.red('Remote creation failed.'));
    const msg = String(err?.stderr || err?.message || err);
    if (/already exists/i.test(msg)) {
      fail(`A repository named "${name}" already exists.`, {
        hint: 'Pick another name with -d <dir>, then rerun.',
      });
    }
    fail(msg);
  }
}

async function run(repoArg, opts) {
  p.intro(pc.bgCyan(pc.black(' github-mirror ')));

  const parsed = parseRepoUrl(repoArg);
  if (parsed.error) fail(parsed.error, { hint: 'github-mirror --help shows examples.' });
  p.log.step(`Upstream: ${pc.cyan(parsed.slug)}  ${pc.dim(parsed.url)}`);

  if (!['private', 'public'].includes(opts.visibility)) {
    fail(`Invalid --visibility "${opts.visibility}"`, { hint: 'use private or public' });
  }

  // ---- 1. Resolve target directory ------------------------------------
  const cwd = process.cwd();
  let targetDir;

  if (opts.dir) {
    targetDir = path.resolve(opts.dir);
    if (fs.existsSync(targetDir)) {
      if (!isEmptyDir(targetDir)) fail(`Directory not empty: ${targetDir}`);
    } else {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    p.log.success(`Target directory: ${pc.bold(targetDir)}`);
  } else if (isEmptyDir(cwd)) {
    targetDir = cwd;
    p.log.success(`Current directory is empty — scaffolding ${pc.bold('in place')}.`);
  } else if (isInteractive) {
    const def = defaultDirName(parsed.repo, cwd);
    const answer = await p.text({
      message: 'Current directory is not empty. Name for the new mirror directory?',
      placeholder: def,
      defaultValue: def,
      validate: (v) => {
        if (!v?.trim()) return 'Please enter a directory name.';
        if (!DIR_NAME_RE.test(v.trim())) return 'Use letters, digits, dots, dashes, underscores.';
        if (v !== '.' && v !== '..' && /[\\/]/.test(v)) return 'Name only — no path separators.';
        return undefined;
      },
    });
    if (p.isCancel(answer)) cancelOut();
    targetDir = path.resolve(String(answer).trim());
    if (fs.existsSync(targetDir) && !isEmptyDir(targetDir)) {
      fail(`Directory not empty: ${targetDir}`);
    }
    fs.mkdirSync(targetDir, { recursive: true });
    p.log.success(`Created ${pc.bold(targetDir)}`);
  } else {
    fail('Current directory is not empty.', {
      hint: 'non-interactive session — pass a directory with -d <name>',
    });
  }

  // ---- 2. Scaffold files ----------------------------------------------
  const s = p.spinner();
  s.start('Writing scaffold');
  const files = scaffold(targetDir, parsed);
  s.stop('Scaffold written:');
  for (const f of files) p.log.message(`${pc.dim('  •')} ${f}`);

  // ---- 3. git init + commit -------------------------------------------
  let gitReady = false;
  if (hasBin('git')) {
    s.start('Initializing git repository');
    try {
      gitInit(targetDir, parsed.slug);
      gitReady = true;
      s.stop('Git ready: branch main, initial commit created.');
    } catch (err) {
      s.stop(pc.red('git init failed.'));
      fail(String(err?.message || err));
    }
  } else {
    p.log.warn('git not found — skipped init/commit. Install git and run:');
    p.log.message(
      pc.dim(`  git init -b main && git add -A && git commit -m "chore: init mirror of ${parsed.slug}"`)
    );
  }

  // ---- 4. Optional: create remote + push -------------------------------
  let remoteCreated = false;

  if (opts.create === false) {
    p.log.info('Skipped remote creation (--no-create).');
  } else if (!hasBin('gh')) {
    p.log.warn('GitHub CLI (gh) not found — skipped remote creation.');
  } else if (!isInteractive && !opts.createRemote) {
    p.log.info('Non-interactive session — skipped remote creation.');
    p.log.message(pc.dim('  hint: rerun with -c to create the repo, or push manually.'));
  } else {
    let doCreate = true;
    let visibility = opts.visibility;
    let name = path.basename(targetDir);

    if (isInteractive && !opts.createRemote) {
      const confirmed = await p.confirm({
        message: 'Create the GitHub repository and push now?',
        active: 'Yes',
        inactive: 'No',
      });
      if (p.isCancel(confirmed)) cancelOut();
      doCreate = confirmed;
    }

    if (doCreate) {
      if (isInteractive) {
        const vis = await p.select({
          message: 'Visibility',
          initialValue: visibility,
          options: [
            { value: 'private', label: 'private', hint: 'recommended' },
            { value: 'public', label: 'public' },
          ],
        });
        if (p.isCancel(vis)) cancelOut();
        visibility = vis;

        const answer = await p.text({
          message: 'Repository name',
          defaultValue: name,
          validate: (v) =>
            /^[\w][\w.-]*$/.test(v?.trim() ?? '') ? undefined : 'Invalid repository name.',
        });
        if (p.isCancel(answer)) cancelOut();
        name = String(answer).trim();
      }

      await createRemote(targetDir, { name, visibility });
      remoteCreated = true;
    }
  }

  if (gitReady) manualNextSteps(targetDir, remoteCreated);

  p.outro(
    remoteCreated
      ? `Done! Run the sync: Actions → ${pc.bold('Sync from upstream')} → Run workflow`
      : `Done! ${pc.dim(`Mirror of ${parsed.slug}, ready to push.`)}`
  );
}

export async function main(argv) {
  const program = new Command();

  program
    .name('github-mirror')
    .description(
      'Scaffold a GitHub repository that force-syncs from an upstream repo via GitHub Actions'
    )
    .version(pkg.version, '-V, --version')
    .argument('<repo>', 'upstream repo: https URL, git@ ssh form, or owner/repo')
    .option('-d, --dir <name>', 'target directory (default: cwd if empty, otherwise prompted)')
    .option('--visibility <type>', 'remote repo visibility: private | public', 'private')
    .option('-c, --create-remote', 'create the GitHub repo and push without prompting (non-interactive)')
    .option('--no-create', 'skip GitHub remote creation entirely')
    .addHelpText(
      'after',
      `
Examples:
  $ github-mirror https://github.com/chenguangwu/chenguangwu.github.io
  $ github-mirror chenguangwu/chenguangwu.github.io -d my-mirror
  $ github-mirror chenguangwu/chenguangwu.github.io -c --visibility public
  $ github-mirror chenguangwu/chenguangwu.github.io --no-create`
    )
    .action(async (repoArg, opts) => {
      await run(repoArg, opts);
    });

  await program.parseAsync(argv, { from: 'user' });
}
