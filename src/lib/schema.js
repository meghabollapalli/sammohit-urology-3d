import { DAYS, formatPhone, phoneDigits } from './clinic-utils.js';

/**
 * schema.org JSON-LD for the clinic, the doctor and the FAQ.
 * Unknown (null) config fields are omitted, never faked.
 */
export function buildJsonLd(clinic, faqs = []) {
  const url = clinic.siteUrl;
  const clinicId = `${url}#clinic`;
  const doctorId = `${url}#doctor`;

  const physician = {
    '@type': 'Physician',
    '@id': doctorId,
    name: clinic.doctor.name,
    medicalSpecialty: 'Urologic',
    description: `${clinic.doctor.title}. ${clinic.doctor.degrees.join(', ')}.`,
    hasCredential: clinic.doctor.degrees.map(d => ({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'degree',
      name: d
    })),
    worksFor: { '@id': clinicId }
  };
  if (clinic.doctor.languages?.length) physician.knowsLanguage = clinic.doctor.languages;

  const medicalClinic = {
    '@type': 'MedicalClinic',
    '@id': clinicId,
    name: clinic.name,
    url,
    medicalSpecialty: 'Urologic',
    hasMap: clinic.mapsUrl,
    employee: { '@id': doctorId },
    availableService: [
      'Retrograde intrarenal surgery (RIRS)',
      'Ureteroscopic laser lithotripsy (URSL)',
      'Percutaneous nephrolithotomy (PCNL / Mini-PCNL)',
      'Holmium laser enucleation of the prostate (HoLEP)',
      'Transurethral resection of the prostate (TURP)',
      'Erectile dysfunction treatment',
      'Penile injection therapy (Bimix, Trimix) for erectile dysfunction',
      'Premature ejaculation treatment',
      'Male infertility and varicocele care'
    ].map(name => ({ '@type': 'MedicalProcedure', name }))
  };

  if (phoneDigits(clinic)) medicalClinic.telephone = formatPhone(clinic.contact.phone);
  if (clinic.contact?.email) medicalClinic.email = clinic.contact.email;

  const a = clinic.address || {};
  if (a.street || a.city) {
    const address = { '@type': 'PostalAddress', addressCountry: a.country || 'IN' };
    if (a.street) address.streetAddress = [a.street, a.locality].filter(Boolean).join(', ');
    if (a.city) address.addressLocality = a.city;
    if (a.region) address.addressRegion = a.region;
    if (a.postalCode) address.postalCode = a.postalCode;
    medicalClinic.address = address;
  }
  if (clinic.geo && typeof clinic.geo.lat === 'number' && typeof clinic.geo.lng === 'number') {
    medicalClinic.geo = { '@type': 'GeoCoordinates', latitude: clinic.geo.lat, longitude: clinic.geo.lng };
  }
  if (Array.isArray(clinic.hours) && clinic.hours.length) {
    medicalClinic.openingHoursSpecification = clinic.hours.map(h => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days.map(d => DAYS[d]),
      opens: h.opens,
      closes: h.closes
    }));
  }

  const graph = [medicalClinic, physician];
  if (faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
