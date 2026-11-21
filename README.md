# Sammohit’s Urology and Andrology Center website

Website for **Dr. G SVS Sammohit** (M.S General Surgery, M.Ch Urology), urologist and andrologist. One page with a scroll-driven 3D model of the urinary tract that explains kidney stone and prostate treatment, plus everything a patient needs to book.

Live: https://meghabollapalli.github.io/sammohit-urology-3d/ (deployed automatically from `main`).

## Add the clinic’s details

All clinic facts live in [`src/clinic.config.js`](src/clinic.config.js). Fields that are `null` are hidden on the site and left out of the Google structured data. `npm run build` lists whatever is still missing.

Filling in `contact.phone` turns on every Call button; `contact.whatsapp` (or the phone number as a fallback) turns on WhatsApp booking.

## Develop

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (Vitest)
npm run build        # production build + first-load size budget
npm run test:e2e     # Playwright end-to-end + axe accessibility tests (desktop and phone)
```

`npm run test:e2e` builds with `tests/fixtures/clinic.fixture.js`, a fake, fully filled config, so every button and the booking flow can be tested. It is never deployed.

## How it fits together

| File | Role |
| --- | --- |
| `index.html` | All page content. `{{tokens}}`, `<!-- @markers -->` and `data-requires` are filled from the config at build time by `src/lib/render.js`. |
| `src/clinic.config.js` | Clinic facts (single source of truth). |
| `src/content/faq.js` | FAQ, rendered into the page and into FAQPage schema. |
| `src/content/stones.js` | Copy for the stone size and procedure pickers. |
| `src/main.js` | Menu, pickers and WhatsApp booking. |
| `src/motion.js` | Headline word reveals, scroll reveals, header progress, chapter rail. Skipped with reduced motion. |
| `public/fonts/` | Self-hosted Instrument Serif (display) and Inter Tight (text), both SIL Open Font License. |
| `src/stage.js` | Decides when to load the 3D: still image first, three.js after page load, opt-in with reduced motion or Data Saver, paused when off screen. |
| `src/scene3d.js` | The three.js scene (lazy-loaded chunk). |
| `public/img/` | Still renders of the scene (poster images) and the social preview image. |

## Content rules

- Facts only: qualifications, procedures, how they work, contact details. No outcome percentages, superlatives, testimonials or before/after images.
- Never put a guessed phone number, address or registration number in the config.
- Name procedures in plain words first, abbreviation second.
