/**
 * Build-time HTML rendering: fills clinic facts from `clinic.config.js` into
 * index.html so contact details, FAQ and structured data are present in the
 * static HTML (no JavaScript needed to read or use them).
 *
 * Template syntax used in index.html:
 *   {{token}}                          replaced with an escaped value
 *   <!-- @faq -->, <!-- @jsonld -->,   replaced with generated blocks
 *   <!-- @visit-details --> and the other <!-- @name --> markers in BLOCKS below
 *   <tag data-requires="phone">…</tag>  removed when the clinic has no phone
 *   <tag data-requires-not="booking">…  removed when the clinic DOES have it
 * Capabilities: phone, whatsapp, booking, registration, languages, reviews, reviewtext, blog.
 * Elements using data-requires must not contain a nested element with the same tag name.
 */
import {
  bookingChannel,
  formatAddress,
  formatHours,
  formatPhone,
  telHref,
  whatsappHref
} from './clinic-utils.js';
import { buildJsonLd } from './schema.js';
import { CONCERNS, PREFERRED_TIMES } from './clinic-utils.js';
import { escapeHtml } from './html.js';
import { BLOG, renderPostCards } from './blog.js';
import { renderBrand, renderFooter } from './chrome.js';
import { MODALITY_COPY, SIZE_COPY, modalityHtml } from '../content/stones.js';

export function capabilities(clinic) {
  return {
    phone: Boolean(telHref(clinic)),
    whatsapp: Boolean(whatsappHref(clinic)),
    booking: Boolean(bookingChannel(clinic)),
    registration: Boolean(clinic.doctor?.registrationNumber),
    languages: Boolean(clinic.doctor?.languages?.length),
    reviews: Boolean(googleRating(clinic))
  };
}

/** { rating: '5.0', stars: 5 } or null. */
export function googleRating(clinic) {
  const g = clinic.googleReviews;
  if (!g || typeof g.rating !== 'number') return null;
  return {
    rating: g.rating.toFixed(1),
    stars: Math.max(0, Math.min(5, Math.round(g.rating)))
  };
}

const starRow = n => Array.from({ length: 5 }, (_, i) => `<i class="star${i < n ? '' : ' star-off'}"></i>`).join('');

function renderReviews(reviews) {
  return reviews
    .map(
      r => `<li class="review-card">
              <p class="review-stars"><span class="sr-only">${Number(r.stars)} out of 5 stars</span><span aria-hidden="true">${starRow(Number(r.stars))}</span></p>
              <blockquote>${r.text
                .split(/\n+/)
                .map(t => `<p>${escapeHtml(t.trim())}</p>`)
                .join('')}</blockquote>
              <p class="review-by">${escapeHtml(r.name)}<span>Google review</span></p>
            </li>`
    )
    .join('\n            ');
}

function renderFaq(faqs) {
  return faqs
    .map(
      f => `<details class="faq-item">
          <summary><span>${escapeHtml(f.q)}</span></summary>
          <p>${escapeHtml(f.a)}</p>
        </details>`
    )
    .join('\n        ');
}

function renderVisitDetails(clinic) {
  const rows = [];
  const address = formatAddress(clinic);
  rows.push(
    `<div class="visit-row"><dt>Address</dt><dd>${
      address
        ? address.map(escapeHtml).join('<br />')
        : `${escapeHtml(clinic.name)}<br /><span class="muted">Full address coming soon. Use the map link for directions.</span>`
    }</dd></div>`
  );
  const hours = formatHours(clinic);
  rows.push(
    `<div class="visit-row"><dt>Hours</dt><dd>${
      hours
        ? hours.map(h => `<span class="hours-line"><span>${escapeHtml(h.days)}</span> <span>${escapeHtml(h.time)}</span></span>`).join('')
        : '<span class="muted">Please call or message before visiting to confirm timings.</span>'
    }</dd></div>`
  );
  // The phone number is not listed here: the Call button under the list carries it.
  if (clinic.contact?.whatsapp && whatsappHref(clinic)) {
    rows.push(
      `<div class="visit-row"><dt>WhatsApp</dt><dd><a href="${escapeHtml(whatsappHref(clinic))}" target="_blank" rel="noopener">${escapeHtml(formatPhone(clinic.contact.whatsapp))}</a></dd></div>`
    );
  }
  if (clinic.contact?.email) {
    rows.push(
      `<div class="visit-row"><dt>Email</dt><dd><a href="mailto:${escapeHtml(clinic.contact.email)}">${escapeHtml(clinic.contact.email)}</a></dd></div>`
    );
  }
  return `<dl class="visit-list">\n          ${rows.join('\n          ')}\n        </dl>`;
}

function stripByCapability(html, caps) {
  const re = /<([a-z][a-z0-9]*)\b([^>]*?)\sdata-requires(-not)?="([a-z,]+)"([^>]*)>[\s\S]*?<\/\1>\s*/g;
  let prev;
  // Loop so that removals inside kept elements are also processed.
  do {
    prev = html;
    html = html.replace(re, (match, tag, before, not, names, after) => {
      const have = names.split(',').every(n => caps[n]);
      const keep = not ? !have : have;
      if (!keep) return '';
      return match.replace(/\sdata-requires(-not)?="[a-z,]+"/, '');
    });
  } while (html !== prev);
  return html;
}

export function renderIndexHtml(html, clinic, faqs, { reviews = [], posts = [] } = {}) {
  const caps = capabilities(clinic);
  // Review text is shown only alongside the rating it belongs to.
  caps.reviewtext = caps.reviews && reviews.length > 0;
  caps.blog = posts.length > 0;
  const procedures = clinic.doctor.proceduresPerformed;
  const rating = googleRating(clinic);
  const tokens = {
    clinicName: clinic.name,
    doctorName: clinic.doctor.name,
    doctorTitle: clinic.doctor.title,
    degrees: clinic.doctor.degrees.join(', '),
    // Postgraduate degrees only, e.g. "M.S, M.Ch (Urology)": the field in brackets is kept on the last one.
    degreesShort: clinic.doctor.degrees
      .slice(1)
      .map((d, i, all) => (i < all.length - 1 ? d.replace(/\s*\(.*\)$/, '') : d))
      .join(', '),
    procedures: procedures ? `${procedures.toLocaleString('en-IN')}+` : '',
    proceduresNumber: procedures ? procedures.toLocaleString('en-IN') : '',
    tel: telHref(clinic) || '',
    phoneDisplay: formatPhone(clinic.contact?.phone) || '',
    whatsapp: whatsappHref(clinic) || '',
    mapsUrl: clinic.mapsUrl,
    siteUrl: clinic.siteUrl,
    registration: clinic.doctor.registrationNumber || '',
    languages: (clinic.doctor.languages || []).join(', '),
    reviewsRating: rating ? rating.rating : '',
    blogTitle: BLOG.title,
    blogHref: `./${BLOG.dir}/index.html`
  };

  let out = stripByCapability(html, caps);
  const options = map =>
    Object.entries(map)
      .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
      .join('');
  const BLOCKS = {
    faq: renderFaq(faqs),
    stars: rating ? starRow(rating.stars) : '',
    brand: renderBrand(),
    footer: renderFooter(clinic),
    reviews: renderReviews(reviews),
    blog: renderPostCards(posts.slice(0, 3), `./${BLOG.dir}/`),
    'visit-details': renderVisitDetails(clinic),
    'concern-options': options(CONCERNS),
    'time-options': options(PREFERRED_TIMES),
    // The pickers' starting text: the same copy the buttons swap in later.
    'size-result': SIZE_COPY[8],
    'modality-result': modalityHtml(MODALITY_COPY.ursl),
    jsonld: `<script type="application/ld+json">${JSON.stringify(buildJsonLd(clinic, faqs)).replace(/</g, '\\u003c')}</script>`
  };
  out = out.replace(/<!-- @([a-z-]+) -->/g, (m, name) => {
    if (!(name in BLOCKS)) throw new Error(`Unknown block <!-- @${name} --> in index.html`);
    return BLOCKS[name];
  });
  out = out.replace(/\{\{(\w+)\}\}/g, (m, key) => {
    if (!(key in tokens)) throw new Error(`Unknown template token {{${key}}} in index.html`);
    return escapeHtml(tokens[key]);
  });
  return out;
}
