# Notes for Claude

- Medical marketing site for an Indian urologist. Keep copy factual and plain; no outcome stats or superlatives in the clinic's own copy (see README "Content rules"). The one exception, at the owner's request, is the Google reviews carousel: quote reviews word for word from the listing, never edit or invent them.
- Blog articles are medical content: mark new ones `draft: true` until the doctor has reviewed them.
- Images ship as AVIF with a WebP fallback and width variants; encode from the original, not from an already compressed file.
- Never invent clinic contact details, addresses, hours or registration numbers. Unknown values stay `null` in `src/clinic.config.js`.
- Booking goes through WhatsApp / phone only; the site stores nothing. Never insert user input as HTML.
- Keep first-load JS/CSS within the budget in `scripts/check-budget.js`; three.js must stay in the lazy `scene3d` chunk.
- Before opening a PR run `npm test`, `npm run build` and `npm run test:e2e`.
- If the 3D camera framing changes, regenerate `public/img/stage-*.webp` and `og.jpg` from the live scene.
- The live site is the `site-preview` branch (built files only). `.github/workflows/deploy.yml` writes it from `main`; until `main` carries the site, publish a fresh `npm run build` there by hand. Do not change the Pages source.
