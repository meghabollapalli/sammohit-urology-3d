import { clinic } from './clinic.config.js';
import { bookingChannel, buildBookingMessage, telHref, whatsappHref } from './lib/clinic-utils.js';
import { initStage } from './stage.js';
import { MODALITY_COPY, SIZE_COPY } from './content/stones.js';

const stage = initStage();

/* ---------------------------------------------------------------------------
 * Mobile menu
 * ------------------------------------------------------------------------- */
const menuBtn = document.querySelector('.menu-btn');
const nav = document.getElementById('primary-nav');
if (menuBtn && nav) {
  const setOpen = open => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
  };
  menuBtn.addEventListener('click', () => setOpen(menuBtn.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', e => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      menuBtn.focus();
    }
  });
}

/* ---------------------------------------------------------------------------
 * Stone size picker and procedure comparison (drive the 3D scene)
 * ------------------------------------------------------------------------- */
function setPressed(buttons, active) {
  buttons.forEach(b => b.setAttribute('aria-pressed', String(b === active)));
}

const sizeButtons = [...document.querySelectorAll('[data-mm]')];
const sizeResult = document.getElementById('size-result');
sizeButtons.forEach(btn =>
  btn.addEventListener('click', () => {
    const mm = Number(btn.dataset.mm);
    setPressed(sizeButtons, btn);
    if (sizeResult && SIZE_COPY[mm]) sizeResult.innerHTML = SIZE_COPY[mm];
    stage.call('setStoneSize', mm);
  })
);

const modalityButtons = [...document.querySelectorAll('[data-modality]')];
const modalityResult = document.getElementById('modality-result');
modalityButtons.forEach(btn =>
  btn.addEventListener('click', () => {
    const key = btn.dataset.modality;
    const copy = MODALITY_COPY[key];
    if (!copy) return;
    setPressed(modalityButtons, btn);
    if (modalityResult) {
      modalityResult.innerHTML =
        `<p>${copy.text}</p><ul class="tag-row">` + copy.tags.map(t => `<li>${t}</li>`).join('') + '</ul>';
    }
    stage.call('setModality', key);
  })
);

/* ---------------------------------------------------------------------------
 * Booking: opens WhatsApp (or a phone call) with a ready-written message.
 * Nothing is stored or sent anywhere by this site.
 * ------------------------------------------------------------------------- */
const form = document.getElementById('book-form');
const channel = bookingChannel(clinic);
if (form && channel) {
  const submit = document.getElementById('book-submit');
  const privacy = form.querySelector('.privacy');
  if (channel === 'phone') {
    submit.textContent = 'Call the clinic to book';
    if (privacy) privacy.textContent = 'This starts a phone call to the clinic. Nothing is stored on this website.';
  }

  const nameInput = document.getElementById('book-name');
  const nameError = document.getElementById('book-name-error');
  const showNameError = show => {
    nameError.hidden = !show;
    nameInput.setAttribute('aria-invalid', String(show));
    if (show) nameInput.setAttribute('aria-describedby', 'book-name-hint book-name-error');
    else nameInput.setAttribute('aria-describedby', 'book-name-hint');
  };
  nameInput.addEventListener('input', () => {
    if (nameInput.value.trim()) showNameError(false);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!String(data.name || '').trim()) {
      showNameError(true);
      nameInput.focus();
      return;
    }
    if (channel === 'whatsapp') {
      const url = whatsappHref(clinic, buildBookingMessage(data, clinic));
      window.open(url, '_blank', 'noopener');
    } else {
      window.location.href = telHref(clinic);
    }
  });
}

// "Book a private consultation" pre-selects the matching concern.
document.querySelectorAll('[data-concern]').forEach(link =>
  link.addEventListener('click', () => {
    const select = document.getElementById('book-concern');
    if (select) select.value = link.dataset.concern;
  })
);
