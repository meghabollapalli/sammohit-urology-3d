/** Pure helpers over `clinic.config.js`. No DOM access, so they run in Node tests and the build. */

const DAY_NAMES = { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun' };
const DAY_ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** "+91 98765-43210" -> "919876543210"; null for empty/invalid input. */
export function digitsOnly(value) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

export function phoneDigits(clinic) {
  return digitsOnly(clinic.contact?.phone);
}

export function whatsappDigits(clinic) {
  return digitsOnly(clinic.contact?.whatsapp) || phoneDigits(clinic);
}

export function telHref(clinic) {
  const d = phoneDigits(clinic);
  return d ? `tel:+${d}` : null;
}

/** Human display for Indian numbers: "+91 98765 43210"; other numbers are left grouped as typed. */
export function formatPhone(value) {
  const d = digitsOnly(value);
  if (!d) return null;
  if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return `+${d}`;
}

export function whatsappHref(clinic, text = '') {
  const d = whatsappDigits(clinic);
  if (!d) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export const CONCERNS = {
  stone: 'Kidney or ureter stone',
  prostate: 'Prostate / urine flow problems',
  andrology: 'Men’s sexual health (confidential)',
  infertility: 'Male infertility',
  general: 'General urology or scan review'
};

export const PREFERRED_TIMES = {
  any: 'Any time',
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening'
};

/** The WhatsApp message a patient sends to request an appointment. */
export function buildBookingMessage({ name, concern, time, note } = {}, clinic) {
  const lines = [`Hello, I would like to book a consultation with ${clinic.doctor.name}.`];
  const cleanName = (name || '').trim().slice(0, 80);
  if (cleanName) lines.push(`Name: ${cleanName}`);
  if (concern && CONCERNS[concern]) lines.push(`Concern: ${CONCERNS[concern]}`);
  if (time && time !== 'any' && PREFERRED_TIMES[time]) lines.push(`Preferred time: ${PREFERRED_TIMES[time]}`);
  const cleanNote = (note || '').trim().slice(0, 500);
  if (cleanNote) lines.push(`Note: ${cleanNote}`);
  return lines.join('\n');
}

/** Which booking channel the site can offer: 'whatsapp', 'phone' or null. */
export function bookingChannel(clinic) {
  if (whatsappDigits(clinic)) return 'whatsapp';
  if (phoneDigits(clinic)) return 'phone';
  return null;
}

export function formatAddress(clinic) {
  const a = clinic.address || {};
  const cityLine = [a.city, a.postalCode].filter(Boolean).join(' ');
  const parts = [a.street, a.locality, cityLine, a.region].filter(Boolean);
  return parts.length ? parts : null;
}

function dayRange(days) {
  const idx = days.map(d => DAY_ORDER.indexOf(d)).sort((x, y) => x - y);
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (idx.length > 2 && contiguous) {
    return `${DAY_NAMES[DAY_ORDER[idx[0]]]}–${DAY_NAMES[DAY_ORDER[idx[idx.length - 1]]]}`;
  }
  return idx.map(i => DAY_NAMES[DAY_ORDER[i]]).join(', ');
}

function time12(t) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

/** [{ days: 'Mon–Sat', time: '10 am – 2 pm' }] or null. */
export function formatHours(clinic) {
  if (!Array.isArray(clinic.hours) || clinic.hours.length === 0) return null;
  return clinic.hours.map(h => ({
    days: dayRange(h.days),
    time: `${time12(h.opens)} – ${time12(h.closes)}`
  }));
}

/** Human labels of every config field still missing, for the build warning and the README. */
export function missingFields(clinic) {
  const missing = [];
  if (!phoneDigits(clinic)) missing.push('contact.phone (clinic phone number)');
  if (!digitsOnly(clinic.contact?.whatsapp)) missing.push('contact.whatsapp (WhatsApp booking number; falls back to phone)');
  if (!clinic.address?.street || !clinic.address?.city || !clinic.address?.postalCode) {
    missing.push('address (street, city, postal code)');
  }
  if (!clinic.hours) missing.push('hours (opening hours)');
  if (!clinic.geo) missing.push('geo (map coordinates)');
  if (!clinic.doctor?.registrationNumber) missing.push('doctor.registrationNumber (medical council registration)');
  if (!clinic.doctor?.languages) missing.push('doctor.languages (languages spoken)');
  if (!clinic.contact?.email) missing.push('contact.email (optional)');
  return missing;
}
