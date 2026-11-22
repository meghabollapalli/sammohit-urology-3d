// Test-only clinic config with every field filled (fake values, never shipped).
import { clinic as real } from '../../src/clinic.config.js';

export const clinic = {
  ...real,
  doctor: { ...real.doctor, registrationNumber: 'TEST-REG-0001', languages: ['Telugu', 'Hindi', 'English'] },
  contact: { phone: '+91 90000 00001', whatsapp: '+91 90000 00002', email: 'desk@example.com' },
  address: { street: '1 Test Road', locality: 'Test Nagar', city: 'Testpur', region: 'Telangana', postalCode: '500001', country: 'IN' },
  geo: { lat: 17.4, lng: 78.5 },
  hours: [
    { days: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], opens: '10:00', closes: '14:00' },
    { days: ['Mo', 'Tu', 'We', 'Th', 'Fr'], opens: '17:30', closes: '20:30' }
  ]
};
