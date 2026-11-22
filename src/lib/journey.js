/**
 * The scroll "journey" shared by the 3D scene and the chapter rail, so both
 * always agree on which chapter is in view.
 *
 * Returns a number from 0 to 3: 0 = hero, 1 = symptoms, 2 = stone treatment,
 * 3 = bladder and prostate. It sits exactly on a whole number while that
 * chapter is centred in the reading area (or fills it, when the chapter is
 * taller) and moves evenly between chapters.
 *
 * The reading area is the whole screen on wide layouts. On phones the 3D panel
 * is pinned to the top, so it is the part of the screen below that panel. Its
 * height comes from a 100lvh probe, not from window.innerHeight, so the value
 * does not twitch when a phone browser's address bar slides in or out.
 */
const STOPS = ['.hero', '#symptoms', '#stones', '#prostate'];
const PHONE = '(max-width: 899px)';
let stopEls = null;
let probe = null;
let stage = null;

/** { top, height } of the reading area, in CSS pixels from the top of the screen. */
export function readingArea(doc = document, win = window) {
  if (!win.matchMedia || !win.matchMedia(PHONE).matches) return { top: 0, height: win.innerHeight };
  if (!probe) {
    probe = doc.createElement('div');
    probe.className = 'vh-probe';
    doc.body.appendChild(probe);
    stage = doc.getElementById('stage');
  }
  const full = probe.offsetHeight || win.innerHeight;
  const top = stage ? stage.offsetHeight : 0;
  return { top, height: Math.max(1, full - top) };
}

export function journeyRanges(doc = document, win = window) {
  if (!stopEls) stopEls = STOPS.map(sel => doc.querySelector(sel));
  const area = readingArea(doc, win);
  const middle = area.top + area.height / 2;
  const y = win.scrollY;
  let prev = [0, 0];
  return stopEls.map((el, i) => {
    if (i === 0 || !el) return prev;
    const r = el.getBoundingClientRect();
    const top = r.top + y;
    const half = Math.min(r.height, area.height) / 2;
    const from = Math.max(prev[1] + 1, top + half - middle);
    prev = [from, Math.max(from, top + r.height - half - middle)];
    return prev;
  });
}

export function journeyFromRanges(ranges, y) {
  for (let i = 1; i < ranges.length; i++) {
    const [from, to] = ranges[i];
    const prevTo = ranges[i - 1][1];
    if (y < from) return i - 1 + Math.max(0, y - prevTo) / Math.max(1, from - prevTo);
    if (y <= to) return i;
  }
  return ranges.length - 1;
}

export function journeyValue() {
  return journeyFromRanges(journeyRanges(), window.scrollY);
}
