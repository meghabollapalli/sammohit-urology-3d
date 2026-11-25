/** Node-only: reads the markdown posts from disk (used by the Vite config and tests). */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parsePost, sortPosts } from './blog.js';

const DIR = fileURLToPath(new URL('../content/blog/', import.meta.url));

export function loadPosts() {
  return sortPosts(
    readdirSync(DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => parsePost(readFileSync(DIR + f, 'utf8'), f.replace(/\.md$/, '')))
  );
}
