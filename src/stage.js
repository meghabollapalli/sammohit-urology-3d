/**
 * Decides whether and when to load the live 3D scene.
 *
 * - A still render (poster) is always shown first, so the page is complete
 *   without WebGL or JavaScript.
 * - The scene (and three.js) is a separate chunk loaded after the page is idle.
 * - With reduced motion, Data Saver or a slow (2G/3G) connection, it only loads
 *   when the visitor asks.
 * - Rendering pauses while the journey is off screen or the tab is hidden.
 */
export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function initStage() {
  const stageEl = document.getElementById('stage');
  const container = document.getElementById('webgl-container');
  const journey = document.getElementById('journey');
  const loadBtn = document.getElementById('load-3d');

  const pending = {};
  let controller = null;
  let loading = false;
  let journeyVisible = true;

  const api = {
    /** Forward a call to the scene; remembered and replayed if it is not loaded yet. */
    call(method, ...args) {
      pending[method] = args;
      if (controller && typeof controller[method] === 'function') controller[method](...args);
    },
    get loaded() {
      return Boolean(controller);
    },
    load
  };

  if (!stageEl || !container) return api;

  const syncRunning = () => {
    if (!controller) return;
    if (journeyVisible && !document.hidden) controller.start();
    else controller.stop();
  };

  if (journey && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      journeyVisible = entries[0].isIntersecting;
      stageEl.classList.toggle('is-offscreen', !journeyVisible);
      syncRunning();
    }).observe(journey);
  }
  document.addEventListener('visibilitychange', syncRunning);

  async function load() {
    if (loading || controller) return;
    loading = true;
    if (loadBtn) loadBtn.hidden = true;
    stageEl.classList.add('is-loading');
    try {
      const { initUrology3DScene } = await import('./scene3d.js');
      const lowPower =
        window.innerWidth < 900 ||
        (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
        (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
      controller = initUrology3DScene({
        container,
        lowPower: Boolean(lowPower),
        onFirstFrame: () => {
          stageEl.classList.remove('is-loading');
          stageEl.classList.add('is-live');
          document.documentElement.dataset.scene = 'live';
        }
      });
      for (const [method, args] of Object.entries(pending)) controller?.[method]?.(...args);
      syncRunning();
    } catch (err) {
      console.warn('3D scene unavailable, keeping the still image.', err);
      stageEl.classList.remove('is-loading');
    }
  }

  if (!supportsWebGL()) return api;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const conn = navigator.connection;
  const saveData = Boolean(conn && conn.saveData);
  const slowNetwork = Boolean(conn && /(^|-)(2g|3g)$/.test(conn.effectiveType || ''));

  if (reducedMotion || saveData || slowNetwork) {
    if (loadBtn) {
      loadBtn.hidden = false;
      loadBtn.addEventListener('click', load, { once: true });
    }
    return api;
  }

  const whenIdle = cb =>
    'requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 1200);
  if (document.readyState === 'complete') whenIdle(load);
  else window.addEventListener('load', () => whenIdle(load), { once: true });

  return api;
}
