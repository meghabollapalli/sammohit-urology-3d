/**
 * Page motion: split-word headline reveals, fade-up reveals, header state,
 * scroll progress and the journey chapter rail. Everything is skipped (content
 * shown immediately) when the visitor prefers reduced motion; CSS handles that.
 */
import { journeyValue } from './lib/journey.js';

function splitWords(el) {
  let i = 0;
  const walk = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
            return;
          }
          const outer = document.createElement('span');
          outer.className = 'w';
          const inner = document.createElement('span');
          inner.textContent = part;
          inner.style.setProperty('--i', String(i++));
          outer.appendChild(inner);
          frag.appendChild(outer);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };
  walk(el);
}

export function initMotion() {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Headlines: split into words (screen readers read the heading's text as normal).
  document.querySelectorAll('[data-split]').forEach(splitWords);

  // Reveal on scroll. Hero items get a short stagger on first paint.
  const revealables = [...document.querySelectorAll('[data-reveal], [data-split]')];
  const hero = document.querySelector('.hero');
  if (hero) {
    hero.querySelectorAll('[data-reveal], [data-split]').forEach((el, n) => {
      el.style.setProperty('--delay', `${0.15 + n * 0.12}s`);
    });
  }
  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(el => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    revealables.forEach(el => io.observe(el));
    // Stagger siblings in lists so rows cascade.
    document.querySelectorAll('.index-list, .proc-list, .andro-main').forEach(list => {
      [...list.children].forEach((child, n) => child.style.setProperty('--delay', `${(n % 6) * 0.08}s`));
    });
  }

  // Header background, scroll progress and the chapter rail. The rail follows
  // the same journey value as the 3D scene, so the two never disagree.
  const header = document.querySelector('.site-header');
  const chapterLinks = [...document.querySelectorAll('.chapters a')];
  const journeyEnd = document.getElementById('journey-end-anchor');
  const CHAPTERS = [null, 'symptoms', 'stones', 'prostate'];
  let ticking = false;
  let lastJourney = 0;
  window.addEventListener('pagehide', () => {
    try {
      sessionStorage.setItem('journey', lastJourney.toFixed(3));
    } catch {
      /* private mode: the still simply shows as usual */
    }
  });
  const onScroll = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const y = window.scrollY;
    if (header) {
      header.classList.toggle('is-scrolled', y > 24);
      header.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : '0');
    }
    // The still image shows the hero. Away from the hero, the stage stays dark
    // until the live scene takes over (see the inline script in index.html).
    const j = journeyValue();
    root.classList.toggle('no-still', j > 0.12);
    lastJourney = j;
    if (chapterLinks.length) {
      const inJourney = !journeyEnd || journeyEnd.getBoundingClientRect().top > window.innerHeight * 0.5;
      const current = CHAPTERS[Math.round(j)];
      root.classList.toggle('in-chapters', j >= 0.5 && inJourney);
      chapterLinks.forEach(a => {
        const active = a.dataset.chapter === current;
        a.classList.toggle('is-active', active);
        if (active) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }
  };
  const requestTick = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  };
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick, { passive: true });
  window.addEventListener('load', requestTick, { once: true });
  // Late layout changes (fonts, images) move the chapters without a scroll event.
  if ('ResizeObserver' in window) new ResizeObserver(requestTick).observe(document.body);
  onScroll();
}
