# Notes for Claude

- Medical marketing site for an Indian urologist. Keep copy factual and plain; no outcome stats, superlatives or testimonials (see README "Content rules").
- Never invent clinic contact details, addresses, hours or registration numbers. Unknown values stay `null` in `src/clinic.config.js`.
- Booking goes through WhatsApp / phone only; the site stores nothing. Never insert user input as HTML.
- Keep first-load JS/CSS within the budget in `scripts/check-budget.js`; three.js must stay in the lazy `scene3d` chunk.
- Before opening a PR run `npm test`, `npm run build` and `npm run test:e2e`.
- If the 3D camera framing changes, regenerate `public/img/stage-*.webp` and `og.jpg` from the live scene.
