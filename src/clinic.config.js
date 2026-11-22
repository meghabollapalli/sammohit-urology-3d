/**
 * Single source of truth for every clinic fact on the site.
 *
 * The page text, the call / WhatsApp / directions buttons, the booking flow
 * and the Google structured data (JSON-LD) are all generated from this file.
 *
 * Address, phone, hours and map position were taken from the clinic's Google
 * listing on 22 Nov 2026.
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
    degrees: ['MBBS', 'M.S (General Surgery)', 'M.Ch (Urology)'],
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
    phone: '+919032429111',
    /** WhatsApp number in the same format. Falls back to `phone` when null. */
    whatsapp: null,
    email: null
  },

  address: {
    street: 'Prabhavathi Multi Speciality Hospital, 4, Ramannapet 1st Lane',
    locality: 'Lakshmipuram',
    city: 'Guntur',
    region: 'Andhra Pradesh',
    postalCode: '522007',
    country: 'IN'
  },

  /** Decimal degrees, e.g. { lat: 17.385, lng: 78.4867 }. */
  geo: { lat: 16.3118169, lng: 80.4318447 },

  mapsUrl: 'https://maps.app.goo.gl/YMChaGH4DkSuD63o9?g_st=ic',

  /**
   * Opening hours. Each entry: { days: ['Mo','Tu',...], opens: '10:00', closes: '14:00' }.
   * Days use schema.org two-letter codes: Mo Tu We Th Fr Sa Su.
   */
  hours: [
    { days: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], opens: '08:00', closes: '21:00' },
    { days: ['Su'], opens: '08:00', closes: '17:00' }
  ],

  /**
   * Rating shown on the clinic's Google listing, with the date it was read.
   * Update both together, or set to `null` to hide the reviews section.
   * The review text in the carousel lives in `src/content/reviews.js`.
   */
  googleReviews: { rating: 5.0, asOf: '2026-11-22' },

  /** Public URL the site is served from (used for canonical + sitemap). */
  siteUrl: 'https://meghabollapalli.github.io/sammohit-urology-3d/'
};

export default clinic;
