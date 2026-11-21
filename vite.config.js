import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { clinic as realClinic } from './src/clinic.config.js';
import { clinic as fixtureClinic } from './tests/fixtures/clinic.fixture.js';
import { faqs } from './src/content/faq.js';
import { renderIndexHtml } from './src/lib/render.js';
import { missingFields } from './src/lib/clinic-utils.js';

// CLINIC_FIXTURE=1 builds with fake, fully filled contact details for end-to-end tests only.
const useFixture = process.env.CLINIC_FIXTURE === '1';
const clinic = useFixture ? fixtureClinic : realClinic;

const FIXTURE_PATH = fileURLToPath(new URL('./tests/fixtures/clinic.fixture.js', import.meta.url));

/** In fixture builds, the browser bundle imports the fixture instead of the real config. */
function clinicFixtureSwap() {
  return {
    name: 'clinic-fixture-swap',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!useFixture || !source.endsWith('clinic.config.js') || importer === FIXTURE_PATH) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved && resolved.id.endsWith('/src/clinic.config.js') ? FIXTURE_PATH : null;
    }
  };
}

function clinicHtml() {
  let warned = false;
  return {
    name: 'clinic-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!warned && !useFixture) {
          warned = true;
          const missing = missingFields(clinic);
          if (missing.length) {
            console.warn(
              `\n[clinic] ${missing.length} clinic details are still empty in src/clinic.config.js; ` +
                `the buttons that need them are hidden:\n  - ${missing.join('\n  - ')}\n`
            );
          }
        }
        return renderIndexHtml(html, clinic, faqs);
      }
    }
  };
}

/** Preload the two fonts the first screen uses (hashed names are only known after bundling). */
function preloadFonts() {
  return {
    name: 'preload-fonts',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html;
      const wanted = ['instrument-serif-', 'inter-tight-'];
      const files = Object.keys(ctx.bundle).filter(
        f => f.endsWith('.woff2') && wanted.some(w => f.split('/').pop().startsWith(w)) && !f.includes('italic')
      );
      return {
        html,
        tags: files.map(f => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `./${f}`, crossorigin: '' },
          injectTo: 'head'
        }))
      };
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [clinicFixtureSwap(), clinicHtml(), preloadFonts()],
  test: { include: ['tests/unit/**/*.test.js'] },
  build: {
    target: 'es2020',
    // three.js is lazy-loaded in its own chunk; only that chunk is large.
    chunkSizeWarningLimit: 700,
    outDir: useFixture ? 'dist-fixture' : 'dist'
  }
});
