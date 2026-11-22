/**
 * Build-time HTML rendering: fills clinic facts from `clinic.config.js` into
 * index.html so contact details, FAQ and structured data are present in the
 * static HTML (no JavaScript needed to read or use them).
 *
 * Template syntax used in index.html:
 *   {{token}}                          replaced with an escaped value
 *   <!-- @faq -->, <!-- @jsonld -->,   replaced with generated blocks
 *   <!-- @visit-details -->
 *   <tag data-requires="phone">…</tag>  removed when the clinic has no phone
 *   <tag data-requires-not="booking">…  removed when the clinic DOES have it
 * Capabilities: phone, whatsapp, booking, email, address, hours, registration, languages, reviews.
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

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function capabilities(clinic) {
  return {
    phone: Boolean(telHref(clinic)),
    whatsapp: Boolean(whatsappHref(clinic)),
    booking: Boolean(bookingChannel(clinic)),
    email: Boolean(clinic.contact?.email),
    address: Boolean(formatAddress(clinic)),
    hours: Boolean(formatHours(clinic)),
    registration: Boolean(clinic.doctor?.registrationNumber),
    languages: Boolean(clinic.doctor?.languages?.length),
    reviews: Boolean(googleRating(clinic))
  };
}

/** { rating: '5.0', count: '68', asOf: '22 November 2026', stars: 5 } or null. */
export function googleRating(clinic) {
  const g = clinic.googleReviews;
  if (!g || typeof g.rating !== 'number' || !(g.count > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(g.asOf || '')) return null;
  const [y, m, d] = g.asOf.split('-').map(Number);
  const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1];
  return {
    rating: g.rating.toFixed(1),
    count: g.count.toLocaleString('en-IN'),
    asOf: `${d} ${month} ${y}`,
    stars: Math.max(0, Math.min(5, Math.round(g.rating)))
  };
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
  if (telHref(clinic)) {
    rows.push(
      `<div class="visit-row"><dt>Phone</dt><dd><a href="${escapeHtml(telHref(clinic))}">${escapeHtml(formatPhone(clinic.contact.phone))}</a></dd></div>`
    );
  }
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

export function renderIndexHtml(html, clinic, faqs) {
  const caps = capabilities(clinic);
  const procedures = clinic.doctor.proceduresPerformed;
  const rating = googleRating(clinic);
  const tokens = {
    clinicName: clinic.name,
    doctorName: clinic.doctor.name,
    doctorTitle: clinic.doctor.title,
    degrees: clinic.doctor.degrees.join(', '),
    degreesShort: 'M.S, M.Ch (Urology)',
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
    reviewsCount: rating ? rating.count : '',
    reviewsAsOf: rating ? rating.asOf : '',
    year: String(new Date().getFullYear())
  };

  let out = stripByCapability(html, caps);
  out = out.replace('<!-- @faq -->', renderFaq(faqs));
  out = out.replace(
    '<!-- @stars -->',
    rating
      ? Array.from({ length: 5 }, (_, i) => `<i class="star${i < rating.stars ? '' : ' star-off'}"></i>`).join('')
      : ''
  );
  out = out.replace('<!-- @visit-details -->', renderVisitDetails(clinic));
  out = out.replace(
    '<!-- @jsonld -->',
    `<script type="application/ld+json">${JSON.stringify(buildJsonLd(clinic, faqs)).replace(/</g, '\\u003c')}</script>`
  );
  out = out.replace(/\{\{(\w+)\}\}/g, (m, key) => {
    if (!(key in tokens)) throw new Error(`Unknown template token {{${key}}} in index.html`);
    return escapeHtml(tokens[key]);
  });
  return out;
}
