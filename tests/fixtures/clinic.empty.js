// Test-only clinic config with every optional fact missing, to prove the site
// hides what it does not know instead of faking it.
import { clinic as real } from '../../src/clinic.config.js';

export const clinic = {
  ...real,
  doctor: { ...real.doctor, registrationNumber: null, languages: null },
  contact: { phone: null, whatsapp: null, email: null },
  address: { street: null, locality: null, city: null, region: null, postalCode: null, country: 'IN' },
  geo: null,
  hours: null,
  googleReviews: null
};
