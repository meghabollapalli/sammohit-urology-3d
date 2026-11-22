import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clinic as real } from '../fixtures/clinic.empty.js';
import { faqs } from '../../src/content/faq.js';
import { clinic as shipped } from '../../src/clinic.config.js';
import { clinic as full } from '../fixtures/clinic.fixture.js';
import { escapeHtml, renderIndexHtml } from '../../src/lib/render.js';
import { buildJsonLd } from '../../src/lib/schema.js';

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

describe('Google rating block', () => {
  it('shows the rating, count and date from the config with a link to Google', () => {
    const html = renderIndexHtml(template, shipped, faqs);
    const g = shipped.googleReviews;
    expect(html).toContain(`${g.count} reviews <em>on Google.</em>`);
    expect(html).toContain('Rating as shown on Google on 22 November 2026.');
    expect(html.match(/class="star"/g)).toHaveLength(5);
    expect(html).toContain('Read all reviews on Google');
  });

  it('is removed when no rating is configured', () => {
    const html = renderIndexHtml(template, real, faqs);
    expect(html).not.toContain('reviews-title');
    expect(html).not.toContain('on Google.</em>');
  });

  it('never marks the rating up as structured data', () => {
    const html = renderIndexHtml(template, shipped, faqs);
    expect(JSON.stringify(jsonLd(html))).not.toMatch(/aggregateRating|"Review"/);
  });
});
