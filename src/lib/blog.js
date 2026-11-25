/**
 * Blog: markdown files in `src/content/blog/` become static pages at build time.
 *
 * Each file starts with a small front-matter block:
 *   ---
 *   title: …
 *   date: YYYY-MM-DD
 *   summary: …
 *   draft: true        (optional; shows a "Draft" badge and keeps search engines out)
 *   ---
 * The body supports a deliberately small markdown subset: `##`/`###` headings,
 * paragraphs, `-` and `1.` lists, **bold**, *italic* and [links](https://…).
 * All text is HTML-escaped; raw HTML in a post is shown as text.
 *
 * To rename the section (for example to "Articles"), change BLOG below.
 */
import { escapeHtml } from './html.js';
import { renderBrand, renderFooter } from './chrome.js';

export const BLOG = { dir: 'blog', title: 'Blog', itemName: 'article' };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function parsePost(raw, slug) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) throw new Error(`Blog post "${slug}" has no front matter`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  if (!meta.title || !formatDate(meta.date)) throw new Error(`Blog post "${slug}" needs a title and a date (YYYY-MM-DD)`);
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Blog file name "${slug}" may only use a-z, 0-9 and hyphens`);
  return {
    slug,
    title: meta.title,
    date: meta.date,
    summary: meta.summary || '',
    draft: meta.draft === 'true',
    html: mdToHtml(m[2])
  };
}

function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\.{0,2}\/[^\s)]*|#[\w-]+)\)/g, '<a href="$2">$1</a>');
}

export function mdToHtml(md) {
  const out = [];
  for (const block of md.trim().split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const h = /^(#{2,3})\s+(.*)$/.exec(lines[0]);
    if (h && lines.length === 1) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    } else if (lines.every(l => /^-\s+/.test(l))) {
      out.push(`<ul>${lines.map(l => `<li>${inline(l.replace(/^-\s+/, ''))}</li>`).join('')}</ul>`);
    } else if (lines.every(l => /^\d+\.\s+/.test(l))) {
      out.push(`<ol>${lines.map(l => `<li>${inline(l.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`);
    } else {
      out.push(`<p>${inline(lines.join(' '))}</p>`);
    }
  }
  return out.join('\n');
}

/** Newest first; ties broken by title so builds are stable. */
export function sortPosts(posts) {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

const draftBadge = '<span class="post-draft">Draft · awaiting the doctor’s review</span>';

/** Cards for a list of posts. `base` is the path from the page to the blog folder. */
export function renderPostCards(posts, base) {
  return posts
    .map(
      p => `<li class="post-card">
            <a href="${base}${p.slug}.html">
              <span class="post-meta"><time datetime="${p.date}">${formatDate(p.date)}</time>${p.draft ? draftBadge : ''}</span>
              <span class="post-title">${escapeHtml(p.title)}</span>
              <span class="post-summary">${escapeHtml(p.summary)}</span>
              <span class="post-more">Read the ${BLOG.itemName}<i class="arrow" aria-hidden="true"></i></span>
            </a>
          </li>`
    )
    .join('\n          ');
}

function page({ clinic, cssHref, title, description, noindex, body }) {
  const home = '../index.html';
  return `<!doctype html>
<html lang="en-IN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(title)} | ${escapeHtml(clinic.doctor.name)}</title>
  <meta name="description" content="${escapeHtml(description)}" />${noindex ? '\n  <meta name="robots" content="noindex" />' : ''}
  <meta name="theme-color" content="#06090d" />
  <link rel="icon" href="../favicon.ico" sizes="any" />
  <link rel="icon" href="../favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="${cssHref}" />
</head>
<body class="blog-page">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header is-solid">
    <div class="header-inner">
      <a href="${home}" class="brand">
        ${renderBrand(', clinic home page')}
      </a>
      <div class="header-actions">
        <a class="link-quiet blog-back" href="${home}">Clinic website</a>
        <a class="btn btn-light btn-sm" href="${home}#book"><span>Book a visit</span></a>
      </div>
    </div>
  </header>
  <main id="main" class="section-bone blog-main">
    <div class="wrap">
${body}
    </div>
  </main>
  ${renderFooter(clinic)}
</body>
</html>
`;
}

export function renderBlogIndex(posts, clinic, cssHref) {
  return page({
    clinic,
    cssHref,
    title: BLOG.title,
    description: `Plain-language articles on kidney stones, prostate problems and andrology from ${clinic.name}.`,
    noindex: posts.every(p => p.draft),
    body: `      <p class="label">${BLOG.title}</p>
      <h1 class="display-lg">Plain answers, written down.</h1>
      <p class="section-lead">Short articles on kidney stones, prostate problems and andrology.</p>
      <ul class="post-list">
          ${renderPostCards(posts, './')}
      </ul>`
  });
}

export function renderBlogPost(post, clinic, cssHref) {
  return page({
    clinic,
    cssHref,
    title: post.title,
    description: post.summary,
    noindex: post.draft,
    body: `      <article class="post">
        <p class="post-crumb"><a href="./index.html">${BLOG.title}</a></p>
        <h1 class="display-lg">${escapeHtml(post.title)}</h1>
        <p class="post-meta"><time datetime="${post.date}">${formatDate(post.date)}</time>${post.draft ? draftBadge : ''}</p>
        <div class="post-body">
${post.html}
        </div>
        <p class="post-foot"><a class="btn btn-dark" href="../index.html#book"><span>Book a consultation</span><i class="arrow" aria-hidden="true"></i></a> <a class="btn btn-line-dark" href="./index.html"><span>All ${BLOG.itemName}s</span></a></p>
      </article>`
  });
}
