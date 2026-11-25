/** Markup shared by the main page and the blog pages: brand lock-up and footer. */
import { escapeHtml } from './html.js';
import { LOGO_MARK } from './logo.js';

/** Inside of the header's brand link. `srSuffix` is extra text for screen readers. */
export function renderBrand(srSuffix = '') {
  return `${LOGO_MARK}
        <span class="brand-text">
          <span class="brand-name">Sammohit</span>
          <span class="brand-sub">Urology &amp; Andrology</span>${srSuffix ? `\n          <span class="sr-only">${escapeHtml(srSuffix)}</span>` : ''}
        </span>`;
}

export function renderFooter(clinic) {
  return `<footer class="site-footer">
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <p class="footer-name">${escapeHtml(clinic.name)}</p>
          <p>${escapeHtml(clinic.doctor.name)}, ${escapeHtml(clinic.doctor.degrees.join(', '))}</p>
        </div>
        <p class="disclaimer">
          This website gives general information and is not a substitute for a consultation. In an emergency, go to the nearest hospital emergency department or call 108 or 112.
        </p>
        <p class="copyright">© ${new Date().getFullYear()} ${escapeHtml(clinic.name)}</p>
      </div>
    </div>
  </footer>`;
}
