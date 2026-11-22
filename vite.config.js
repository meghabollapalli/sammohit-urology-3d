import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { clinic as realClinic } from './src/clinic.config.js';
import { clinic as fixtureClinic } from './tests/fixtures/clinic.fixture.js';
import { faqs } from './src/content/faq.js';
import { renderIndexHtml } from './src/lib/render.js';
import { missingFields } from './src/lib/clinic-utils.js';
import { reviews } from './src/content/reviews.js';
import { BLOG, renderBlogIndex, renderBlogPost } from './src/lib/blog.js';
import { loadPosts } from './src/lib/blog-node.js';

// CLINIC_FIXTURE=1 builds with fake, fully filled contact details for end-to-end tests only.
const useFixture = process.env.CLINIC_FIXTURE === '1';
const clinic = useFixture ? fixtureClinic : realClinic;

const FIXTURE_PATH = fileURLToPath(new URL('./tests/fixtures/clinic.fixture.js', import.meta.url));

/** In fixture builds, the browser bundle imports the fixture instead of the real config.
 *  Only `./clinic.config.js` and `../clinic.config.js` match, so the fixture's own
 *  import of the real file (`../../src/clinic.config.js`) is left alone. */
const fixtureAlias = useFixture ? [{ find: /^\.\.?\/clinic\.config\.js$/, replacement: FIXTURE_PATH }] : [];

/** The blog's posts, or none while `blogEnabled` is off in the clinic config. */
const blogPosts = () => (clinic.blogEnabled ? loadPosts() : []);

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
        return renderIndexHtml(html, clinic, faqs, { reviews, posts: blogPosts() });
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

/** Writes the blog index and one page per markdown post next to the main page. */
function blogPages() {
  const pages = cssHref => {
    const posts = blogPosts();
    if (!posts.length) return {};
    const out = { [`${BLOG.dir}/index.html`]: renderBlogIndex(posts, clinic, cssHref) };
    for (const post of posts) out[`${BLOG.dir}/${post.slug}.html`] = renderBlogPost(post, clinic, cssHref);
    return out;
  };
  return {
    name: 'blog-pages',
    generateBundle(_, bundle) {
      const css = Object.keys(bundle).find(f => f.endsWith('.css'));
      for (const [fileName, source] of Object.entries(pages(`../${css}`))) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0].replace(/^\//, '');
        const html = path.startsWith(`${BLOG.dir}/`) ? pages('/styles.css')[path.endsWith('/') ? `${path}index.html` : path] : null;
        if (!html) return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
    }
  };
}

export default defineConfig({
  base: './',
  resolve: { alias: fixtureAlias },
  plugins: [clinicHtml(), preloadFonts(), blogPages()],
  test: { include: ['tests/unit/**/*.test.js'] },
  build: {
    target: 'es2020',
    // three.js is lazy-loaded in its own chunk; only that chunk is large.
    chunkSizeWarningLimit: 700,
    outDir: useFixture ? 'dist-fixture' : 'dist'
  }
});
