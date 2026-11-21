/**
 * Single source of truth for every clinic fact on the site.
 *
 * The page text, the call / WhatsApp / directions buttons, the booking flow
 * and the Google structured data (JSON-LD) are all generated from this file.
 *
 * RULE: never put a guessed value here. Leave unknown fields as `null`.
 * A `null` field hides the buttons and schema properties that depend on it,
 * and `npm run build` prints a warning listing what is still missing.
 */
export const clinic = {
  name: 'Sammohit’s Urology and Andrology Center',
  shortName: 'Sammohit Urology',

  doctor: {
    name: 'Dr. G SVS Sammohit',
    degrees: ['M.S (General Surgery)', 'M.Ch (Urology)'],
    title: 'Consultant Urologist and Andrologist',
    /** State medical council / NMC registration number, e.g. "TSMC 12345". */
    registrationNumber: null,
    /** Languages the doctor consults in, e.g. ['Telugu', 'Hindi', 'English']. */
    languages: null,
    /** Shown as "1,000+ procedures". Confirm with the clinic before launch. */
    proceduresPerformed: 1000
  },

  contact: {
    /** Full international format, digits only after "+", e.g. "+919876543210". */
    phone: null,
    /** WhatsApp number in the same format. Falls back to `phone` when null. */
    whatsapp: null,
    email: null
  },

  address: {
    street: null,
    locality: null,
    city: null,
    region: null,
    postalCode: null,
    country: 'IN'
  },

  /** Decimal degrees, e.g. { lat: 17.385, lng: 78.4867 }. */
  geo: null,

  mapsUrl: 'https://maps.app.goo.gl/YMChaGH4DkSuD63o9?g_st=ic',

  /**
   * Opening hours. Each entry: { days: ['Mo','Tu',...], opens: '10:00', closes: '14:00' }.
   * Days use schema.org two-letter codes: Mo Tu We Th Fr Sa Su.
   */
  hours: null,

  /** Public URL the site is served from (used for canonical + sitemap). */
  siteUrl: 'https://meghabollapalli.github.io/sammohit-urology-3d/'
};

export default clinic;
