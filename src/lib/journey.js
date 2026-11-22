/**
 * The scroll "journey" shared by the 3D scene and the chapter rail, so both
 * always agree on which chapter is in view.
 *
 * Returns a number from 0 to 3: 0 = hero, 1 = symptoms, 2 = stone treatment,
 * 3 = bladder and prostate. It sits exactly on a whole number while that
 * chapter is centred in the viewport (or fills it, when the chapter is taller
 * than the screen) and moves evenly between chapters.
 *
 * The stops are the chapter sections themselves, not the text cards inside
 * them: on phones the cards are sticky, so their position changes as you scroll.
 */
const STOPS = ['.hero', '#symptoms', '#stones', '#prostate'];
let stopEls = null;

export function journeyRanges(doc = document, win = window) {
  if (!stopEls) stopEls = STOPS.map(sel => doc.querySelector(sel));
  const vh = win.innerHeight;
  const y = win.scrollY;
  let prev = [0, 0];
  return stopEls.map((el, i) => {
    if (i === 0 || !el) return prev;
    const r = el.getBoundingClientRect();
    const top = r.top + y;
    const half = Math.min(r.height, vh) / 2;
    const from = Math.max(prev[1] + 1, top + half - vh / 2);
    prev = [from, Math.max(from, top + r.height - half - vh / 2)];
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
