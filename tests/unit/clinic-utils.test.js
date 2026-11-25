import { describe, expect, it } from 'vitest';
import { clinic as empty } from '../fixtures/clinic.empty.js';
import { clinic as full } from '../fixtures/clinic.fixture.js';
import {
  bookingChannel,
  buildBookingMessage,
  digitsOnly,
  formatAddress,
  formatHours,
  formatPhone,
  missingFields,
  telHref,
  whatsappHref
} from '../../src/lib/clinic-utils.js';

describe('phone helpers', () => {
  it('normalises numbers to digits', () => {
    expect(digitsOnly('+91 98765-43210')).toBe('919876543210');
    expect(digitsOnly('12')).toBeNull();
    expect(digitsOnly(null)).toBeNull();
  });

  it('formats Indian numbers for display', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
    expect(formatPhone(null)).toBeNull();
  });

  it('builds tel and WhatsApp links only when a number exists', () => {
    expect(telHref(empty)).toBeNull();
    expect(whatsappHref(empty)).toBeNull();
    expect(telHref(full)).toBe('tel:+919000000001');
    expect(whatsappHref(full, 'Hi there')).toBe('https://wa.me/919000000002?text=Hi%20there');
  });

  it('falls back to the phone number for WhatsApp', () => {
    const phoneOnly = { ...full, contact: { phone: '+919000000001', whatsapp: null } };
    expect(whatsappHref(phoneOnly)).toBe('https://wa.me/919000000001');
  });
});

describe('booking', () => {
  it('chooses the best available channel', () => {
    expect(bookingChannel(empty)).toBeNull();
    expect(bookingChannel(full)).toBe('whatsapp');
    expect(bookingChannel({ ...full, contact: { phone: '+919000000001' } })).toBe('whatsapp');
  });

  it('writes a readable message and skips empty fields', () => {
    const msg = buildBookingMessage({ name: '  R.K. ', concern: 'andrology', time: 'evening', note: '' }, full);
    expect(msg).toBe(
      'Hello, I would like to book a consultation with Dr. G SVS Sammohit.\n' +
        'Name: R.K.\n' +
        'Concern: Andrology (confidential)\n' +
        'Preferred time: Evening'
    );
  });

  it('ignores unknown concerns and caps long notes', () => {
    const msg = buildBookingMessage({ name: 'A', concern: '<script>', note: 'x'.repeat(900) }, full);
    expect(msg).not.toContain('Concern');
    expect(msg.split('Note: ')[1]).toHaveLength(500);
  });
});

describe('address and hours', () => {
  it('returns null when unknown', () => {
    expect(formatAddress(empty)).toBeNull();
    expect(formatHours(empty)).toBeNull();
  });

  it('formats filled values', () => {
    expect(formatAddress(full)).toEqual(['1 Test Road', 'Test Nagar', 'Testpur 500001', 'Telangana']);
    expect(formatHours(full)).toEqual([
      { days: 'Mon–Sat', time: '10 am – 2 pm' },
      { days: 'Mon–Fri', time: '5:30 pm – 8:30 pm' }
    ]);
  });
});

describe('missingFields', () => {
  it('lists every empty field in an incomplete config', () => {
    expect(missingFields(empty).length).toBeGreaterThan(0);
    expect(missingFields(empty).join(' ')).toContain('contact.phone');
  });

  it('is empty for a complete config', () => {
    expect(missingFields(full)).toEqual([]);
  });
});
