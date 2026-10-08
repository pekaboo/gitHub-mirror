import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'templates');

/**
 * Writes the mirror-repo scaffold into `dir`.
 * @returns {string[]} list of created file paths (relative to dir)
 */
export function scaffold(dir, { slug, url }) {
  const read = (f) => fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf8');
  const render = (tpl) =>
    tpl
      .replaceAll('__UPSTREAM_URL__', url)
      .replaceAll('__UPSTREAM_SLUG__', slug)
      .replaceAll('__REPO_NAME__', path.basename(path.resolve(dir)));

  const files = {
    '.github/workflows/sync-repo.yml': render(read('sync-repo.yml')),
    'README.md': render(read('README.md')),
    '.gitignore': read('gitignore'),
  };

  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return Object.keys(files);
}
