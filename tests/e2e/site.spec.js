import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const isPhone = testInfo => testInfo.project.name === 'phone';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('loads without errors and brings the 3D scene to life', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await expect(page.locator('h1')).toContainText('Precision care for');
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'live', { timeout: 45_000 });
  await expect(page.locator('#stage canvas')).toHaveAttribute('aria-hidden', 'true');
  expect(errors).toEqual([]);
});

test('has no sideways scrolling', async ({ page }) => {
  await page.goto('./');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('every in-page link points at a real section', async ({ page }) => {
  await page.goto('./');
  const missing = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="#"]')]
      .map(a => a.getAttribute('href').slice(1))
      .filter(id => id && !document.getElementById(id))
  );
  expect(missing).toEqual([]);
});

test('shows a still image first and loads three.js only after the page has loaded', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.stage-poster img')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'live', { timeout: 45_000 });
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const scene = performance.getEntriesByType('resource').filter(r => /scene3d-.*\.js/.test(r.name));
    return { loadEnd: nav.loadEventEnd, sceneStarts: scene.map(r => r.startTime) };
  });
  expect(timing.sceneStarts).toHaveLength(1);
  expect(timing.sceneStarts[0]).toBeGreaterThanOrEqual(timing.loadEnd);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('keeps the still image until the visitor asks for 3D', async ({ page }) => {
    const sceneRequests = [];
    page.on('request', r => {
      if (/scene3d-.*\.js/.test(r.url())) sceneRequests.push(r.url());
    });
    await page.goto('./');
    const button = page.getByRole('button', { name: 'Show the interactive 3D model' });
    await expect(button).toBeVisible();
    await page.waitForTimeout(3000);
    expect(sceneRequests).toEqual([]);
    await button.click();
    await expect(page.locator('html')).toHaveAttribute('data-scene', 'live', { timeout: 45_000 });
  });
});

test('stone size and procedure pickers update text and state', async ({ page }) => {
  await page.goto('./');
  const big = page.getByRole('button', { name: 'Over 2 cm' });
  await big.click();
  await expect(big).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '8 mm' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#size-result')).toContainText('over 2 cm');

  const rirs = page.getByRole('button', { name: 'RIRS', exact: true });
  await rirs.click();
  await expect(rirs).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#modality-result')).toContainText('retrograde intrarenal surgery');
});

test('booking opens WhatsApp with a ready-written message', async ({ page }) => {
  await page.goto('./#book');
  await page.evaluate(() => {
    window.__opened = [];
    window.open = url => {
      window.__opened.push(url);
      return null;
    };
  });

  await page.getByRole('button', { name: 'Send request on WhatsApp' }).click();
  await expect(page.getByText('Please enter your name or initials.')).toBeVisible();
  await expect(page.getByLabel('Your name or initials')).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => window.__opened)).toEqual([]);

  await page.getByLabel('Your name or initials').fill('R.K. <b>');
  await page.getByLabel('What is it about?').selectOption('andrology');
  await page.getByLabel('Preferred time').selectOption('evening');
  await page.getByRole('button', { name: 'Send request on WhatsApp' }).click();

  const [url] = await page.evaluate(() => window.__opened);
  expect(url.startsWith('https://wa.me/919000000002?text=')).toBe(true);
  const text = decodeURIComponent(url.split('?text=')[1]);
  expect(text).toContain('Name: R.K. <b>');
  expect(text).toContain('Concern: Andrology (confidential)');
  expect(text).toContain('Preferred time: Evening');
  // Typed text must never be injected into the page as HTML.
  expect(await page.locator('#book b').count()).toBe(0);
});

test('andrology link pre-selects the confidential concern', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Book a private consultation' }).click();
  await expect(page.getByLabel('What is it about?')).toHaveValue('andrology');
});

test('publishes valid structured data', async ({ page }) => {
  await page.goto('./');
  const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  const types = data['@graph'].map(n => n['@type']);
  expect(types).toEqual(['MedicalClinic', 'Physician', 'FAQPage']);
});

test('quick contact is always one tap away on phones', async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo), 'phone only');
  await page.goto('./');
  const bar = page.getByRole('navigation', { name: 'Quick contact' });
  await expect(bar.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+919000000001');
  await expect(bar.getByRole('link', { name: 'WhatsApp' })).toBeVisible();
  await page.mouse.wheel(0, 4000);
  await expect(bar).toBeInViewport();
});

test('mobile menu opens, navigates and closes', async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo), 'phone only');
  await page.goto('./');
  const menu = page.getByRole('button', { name: 'Open menu' });
  await menu.click();
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Questions' }).click();
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('heading', { name: 'Questions patients ask' })).toBeInViewport();
});

test('has no serious accessibility violations', async ({ page }) => {
  // Reduced motion shows every element in its final state, so contrast is
  // measured on what visitors read rather than on mid-animation frames.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.locator('.faq-item').first().locator('summary').click();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations
    .filter(v => ['serious', 'critical'].includes(v.impact))
    .map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`);
  expect(serious).toEqual([]);
});

test('drags on empty space reach the 3D canvas', async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo), 'desktop layout leaves empty space beside the cards');
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'live', { timeout: 45_000 });
  const target = await page.evaluate(() => {
    const el = document.elementFromPoint(window.innerWidth - 200, window.innerHeight / 2);
    return el && el.tagName;
  });
  expect(target).toBe('CANVAS');
});

test('chapter rail matches the chapter that is centred on screen', async ({ page }) => {
  await page.goto('/');
  for (const id of ['symptoms', 'stones', 'prostate']) {
    // Re-centre on every attempt: late font or image loads can move the panel
    // after the first scroll, and a smooth scroll can be cut short.
    await expect(async () => {
      await page.evaluate(sel => {
        const r = document.querySelector(sel).getBoundingClientRect();
        window.scrollTo({ top: r.top + window.scrollY + r.height / 2 - window.innerHeight / 2, behavior: 'instant' });
      }, `#${id} .chapter-panel`);
      await expect(page.locator(`.chapters a[data-chapter="${id}"]`)).toHaveClass(/is-active/, { timeout: 1500 });
      await expect(page.locator('.chapters a.is-active')).toHaveCount(1, { timeout: 1500 });
    }).toPass({ timeout: 20_000 });
  }
});
