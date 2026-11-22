import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clinic as real } from '../fixtures/clinic.empty.js';
import { faqs } from '../../src/content/faq.js';
import { clinic as shipped } from '../../src/clinic.config.js';
import { clinic as full } from '../fixtures/clinic.fixture.js';
import { escapeHtml, renderIndexHtml } from '../../src/lib/render.js';
import { buildJsonLd } from '../../src/lib/schema.js';
import { reviews } from '../../src/content/reviews.js';
import { parsePost, renderBlogIndex, renderBlogPost } from '../../src/lib/blog.js';
import { loadPosts } from '../../src/lib/blog-node.js';

const template = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

function jsonLd(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return JSON.parse(m[1]);
}

describe('renderIndexHtml with an incomplete config', () => {
  const html = renderIndexHtml(template, real, faqs);

  it('leaves no template tokens or markers behind', () => {
    expect(html).not.toMatch(/\{\{\w+\}\}/);
    expect(html).not.toMatch(/<!-- @\w/);
    expect(html).not.toContain('data-requires');
  });

  it('hides call and WhatsApp buttons instead of faking numbers', () => {
    expect(html).not.toContain('href="tel:');
    expect(html).not.toContain('wa.me');
    expect(html).not.toContain('id="book-form"');
    expect(html).toContain('Online booking is being set up');
  });

  it('always keeps directions', () => {
    expect(html).toContain(real.mapsUrl.replace(/&/g, '&amp;'));
  });

  it('omits unknown facts from structured data', () => {
    const clinicNode = jsonLd(html)['@graph'].find(n => n['@type'] === 'MedicalClinic');
    expect(clinicNode.telephone).toBeUndefined();
    expect(clinicNode.address).toBeUndefined();
    expect(clinicNode.openingHoursSpecification).toBeUndefined();
  });
});

describe('renderIndexHtml with a complete config', () => {
  const html = renderIndexHtml(template, full, faqs);

  it('shows call, WhatsApp and the booking form', () => {
    expect(html).toContain('href="tel:+919000000001"');
    expect(html).toContain('https://wa.me/919000000002');
    expect(html).toContain('id="book-form"');
    expect(html).not.toContain('Online booking is being set up');
    expect(html).toContain('TEST-REG-0001');
    expect(html).toContain('Telugu, Hindi, English');
  });

  it('renders every FAQ as an expandable item', () => {
    expect(html.match(/<details class="faq-item">/g)).toHaveLength(faqs.length);
  });

  it('produces valid, complete JSON-LD', () => {
    const graph = jsonLd(html)['@graph'];
    const types = graph.map(n => n['@type']);
    expect(types).toEqual(['MedicalClinic', 'Physician', 'FAQPage']);
    const c = graph[0];
    expect(c.telephone).toBe('+91 90000 00001');
    expect(c.address.postalCode).toBe('500001');
    expect(c.geo.latitude).toBe(17.4);
    expect(c.openingHoursSpecification[0].dayOfWeek).toContain('Saturday');
    expect(graph[2].mainEntity).toHaveLength(faqs.length);
  });
});

describe('safety', () => {
  it('escapes HTML in values', () => {
    expect(escapeHtml('<b a="1">&\'')).toBe('&lt;b a=&quot;1&quot;&gt;&amp;&#39;');
  });

  it('cannot break out of the JSON-LD script tag', () => {
    const evil = { ...full, name: '</script><script>alert(1)</script>' };
    const html = renderIndexHtml('<!-- @jsonld -->', evil, []);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it('rejects unknown template tokens', () => {
    expect(() => renderIndexHtml('{{nope}}', full, [])).toThrow(/nope/);
  });

  it('schema matches visible FAQ text', () => {
    const faqNode = buildJsonLd(full, faqs)['@graph'][2];
    expect(faqNode.mainEntity[0].name).toBe(faqs[0].q);
  });
});

describe('Google reviews section', () => {
  const html = renderIndexHtml(template, shipped, faqs, { reviews });

  it('shows the rating and date from the config, without a review count', () => {
    expect(html).toContain('Rated 5.0 <em>on Google.</em>');
    expect(html).toContain('Read all reviews on Google');
    expect(html).toContain('href="#reviews"');
    expect(html).not.toMatch(/\b68\b/);
  });

  it('renders every review word for word, escaped', () => {
    expect(html.match(/class="review-card"/g)).toHaveLength(reviews.length);
    expect(html).toContain('Sir did URSL for me for affordable price.');
    const evil = renderIndexHtml(template, shipped, faqs, { reviews: [{ name: '<b>x', stars: 5, text: '<img src=x onerror=1>' }] });
    expect(evil).toContain('&lt;img src=x onerror=1&gt;');
    expect(evil).not.toContain('<img src=x');
  });

  it('drops the carousel when there is no review text, and the section when there is no rating', () => {
    expect(renderIndexHtml(template, shipped, faqs)).not.toContain('review-track');
    const none = renderIndexHtml(template, real, faqs, { reviews });
    expect(none).not.toContain('reviews-title');
    expect(none).not.toContain('review-card');
    expect(none).not.toContain('href="#reviews"');
  });

  it('never marks reviews up as structured data', () => {
    expect(JSON.stringify(jsonLd(html))).not.toMatch(/aggregateRating|"Review"/);
  });
});

describe('blog', () => {
  const posts = loadPosts();

  it('parses front matter and a small markdown subset, escaping HTML', () => {
    const post = parsePost('---\ntitle: A: b\ndate: 2026-01-05\nsummary: S\ndraft: true\n---\n\n## Head\n\nText **bold** <script>\n\n- one\n- two\n\n1. first\n', 'a-b');
    expect(post).toMatchObject({ title: 'A: b', date: '2026-01-05', draft: true });
    expect(post.html).toBe('<h2>Head</h2>\n<p>Text <strong>bold</strong> &lt;script&gt;</p>\n<ul><li>one</li><li>two</li></ul>\n<ol><li>first</li></ol>');
    expect(() => parsePost('no front matter', 'x')).toThrow();
  });

  it('lists the posts on the main page and links to their pages', () => {
    const html = renderIndexHtml(template, shipped, faqs, { posts });
    expect(posts.length).toBeGreaterThan(0);
    for (const p of posts.slice(0, 3)) expect(html).toContain(`href="./blog/${p.slug}.html"`);
    expect(renderIndexHtml(template, shipped, faqs)).not.toContain('id="blog"');
  });

  it('marks draft posts and keeps search engines away from them', () => {
    const draft = posts.find(p => p.draft);
    const page = renderBlogPost(draft, shipped, '../assets/x.css');
    expect(page).toContain('Draft · awaiting the doctor’s review');
    expect(page).toContain('<meta name="robots" content="noindex" />');
    expect(renderBlogIndex(posts, shipped, '../assets/x.css')).toContain(`./${draft.slug}.html`);
  });
});
