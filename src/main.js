import { initUrology3DScene } from './scene3d.js';

const controller = initUrology3DScene();

// 1. Interactive 3D Stone Size Selector (4mm, 8mm, 14mm, 22mm+)
const sizeOutcomes = {
  4: '<strong>4 mm Calculus — Conservative / Observation:</strong> ~80% pass naturally with medical expulsive therapy; if persistent pain occurs, URSL clears it rapidly.',
  8: '<strong>8 mm Calculus — URSL / RIRS Candidate:</strong> Frequently impacts in the ureter or lower calyx. Cleared in a single sitting via scarless Holmium laser micro-dusting.',
  14: '<strong>14 mm Calculus — Flexible RIRS Laser Mastery:</strong> Too large to pass naturally. Flexible digital RIRS vaporizes intrarenal stones into sub-millimeter sand with zero skin cuts.',
  22: '<strong>22 mm+ Large / Staghorn Stone — Mini-PCNL:</strong> Pinpoint keyhole tract clearance removes high-volume renal stones completely in a single sitting.'
};

const sizeButtons = document.querySelectorAll('.size-btn');
const sizeReadout = document.getElementById('stone-size-readout');

sizeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    sizeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const mm = parseInt(btn.getAttribute('data-mm'), 10);
    if (controller) controller.setStoneSize(mm);
    if (sizeReadout && sizeOutcomes[mm]) {
      sizeReadout.innerHTML = sizeOutcomes[mm];
    }
  });
});

// 2. Interactive 3D Surgical Modality Switcher (URSL vs RIRS vs PCNL)
const modalityCopy = {
  ursl: {
    desc: '<strong>URSL (Ureteroscopic Lithotripsy):</strong> An ultra-thin endoscope glides naturally through the urinary passage into the ureter—firing a 200-micron Holmium laser fiber that vaporizes impacted ureteric stones with zero skin incisions.',
    m1Val: '0 Cuts',
    m1Lbl: 'Natural Orifice',
    m2Val: '98%+',
    m2Lbl: 'Stone-Free Clearance',
    m3Val: 'Day-Care',
    m3Lbl: 'Rapid Return to Work'
  },
  rirs: {
    desc: '<strong>RIRS (Retrograde Intrarenal Surgery):</strong> A steerable flexible digital scope navigates all the way up inside the 3D kidney calyces—dusting renal stones into fine powder without a single cut on the body.',
    m1Val: 'Scarless',
    m1Lbl: 'Flexible Intrarenal',
    m2Val: '< 0.2 mm',
    m2Lbl: 'Laser Micro-Dust',
    m3Val: '24 Hrs',
    m3Lbl: 'Typical Recovery'
  },
  pcnl: {
    desc: '<strong>PCNL / Mini-PCNL (Percutaneous Nephrolithotomy):</strong> For large (>2 cm) or staghorn kidney stones, a miniature keyhole flank sheath enters the kidney calyx directly to clear the entire stone burden in one sitting.',
    m1Val: 'Keyhole',
    m1Lbl: '5 mm Micro-Tract',
    m2Val: '> 2 cm',
    m2Lbl: 'Large Stone Mastery',
    m3Val: '1 Sitting',
    m3Lbl: 'Complete Clearance'
  }
};

const modalityBtns = document.querySelectorAll('.modality-btn');
const modDesc = document.getElementById('modality-description');
const m1Val = document.getElementById('metric-1-val');
const m1Lbl = document.getElementById('metric-1-lbl');
const m2Val = document.getElementById('metric-2-val');
const m2Lbl = document.getElementById('metric-2-lbl');
const m3Val = document.getElementById('metric-3-val');
const m3Lbl = document.getElementById('metric-3-lbl');

modalityBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    modalityBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const mod = btn.getAttribute('data-modality');
    if (controller) controller.setModality(mod);
    const info = modalityCopy[mod];
    if (info && modDesc) {
      modDesc.innerHTML = info.desc;
      m1Val.textContent = info.m1Val;
      m1Lbl.textContent = info.m1Lbl;
      m2Val.textContent = info.m2Val;
      m2Lbl.textContent = info.m2Lbl;
      m3Val.textContent = info.m3Val;
      m3Lbl.textContent = info.m3Lbl;
    }
  });
});

// 3. Auto-Scroll 3D Guided Tour Button
const autoTourBtn = document.getElementById('auto-tour-btn');
let tourRaf = null;

function stopTour() {
  if (tourRaf) {
    cancelAnimationFrame(tourRaf);
    tourRaf = null;
  }
  if (autoTourBtn) autoTourBtn.textContent = '▶ Tour';
}

if (autoTourBtn) {
  autoTourBtn.addEventListener('click', () => {
    if (tourRaf) {
      stopTour();
      return;
    }
    const anchor = document.getElementById('journey-end-anchor');
    const targetMax = anchor ? anchor.offsetTop - window.innerHeight * 0.35 : 2200;
    if (window.scrollY > targetMax * 0.92) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    autoTourBtn.textContent = '⏸ Pause';

    const step = () => {
      if (window.scrollY >= targetMax) {
        stopTour();
        return;
      }
      window.scrollBy(0, 3.2);
      tourRaf = requestAnimationFrame(step);
    };
    tourRaf = requestAnimationFrame(step);
  });

  window.addEventListener('wheel', stopTour, { passive: true });
  window.addEventListener('touchstart', stopTour, { passive: true });
}

// 4. Dark Surgical Studio / Light Clinical Studio Theme Toggle
const themeBtn = document.getElementById('theme-toggle-btn');
if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    if (next === 'light') {
      html.setAttribute('data-theme', 'light');
      themeBtn.textContent = 'Dark 3D';
    } else {
      html.removeAttribute('data-theme');
      themeBtn.textContent = 'Light 3D';
    }
    if (controller) controller.setTheme(next);
  });
}

// 5. Confidential Clinic Consultation Form Handler
const bookingForm = document.getElementById('consultation-form');
const bookingSuccess = document.getElementById('booking-success-msg');

if (bookingForm && bookingSuccess) {
  bookingForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('patient-name').value.trim();
    const dept = document.getElementById('visit-urgency').value;
    bookingSuccess.style.display = 'block';
    const deptNote =
      dept === 'andrology'
        ? 'discreet, strictly confidential Men’s Sexual Health consultation'
        : dept === 'prostate'
        ? 'HoLEP / TURP prostate evaluation'
        : 'priority urology & laser stone consultation';
    bookingSuccess.innerHTML =
      '<strong>Appointment Request Registered' +
      (name ? ' for ' + name : '') +
      '.</strong> Sammohit’s Urology and Andrology Center desk will contact you privately to confirm your ' +
      deptNote +
      ' with Dr. G SVS Sammohit.';
    bookingForm.reset();
  });
}
