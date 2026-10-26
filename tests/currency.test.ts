import { describe, expect, it } from 'vitest';
import {
  addMoney,
  calculatePercentage,
  formatIDR,
  formatIDRPlain,
  parseIDRInput,
  subtractMoney,
  toSafeRupiahInteger,
} from '../src/lib/currency';
import { positiveRupiahSchema } from '../src/schemas/common.schema';

describe('Finora AI Integer Rupiah Currency Engine', () => {
  it('menjaga presisi integer Rupiah dan menolak nilai NaN atau Infinity', () => {
    expect(toSafeRupiahInteger(150000)).toBe(150000);
    expect(toSafeRupiahInteger(150000.4)).toBe(150000);
    expect(() => toSafeRupiahInteger(Number.NaN)).toThrow();
    expect(() => toSafeRupiahInteger(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('menjumlahkan dan mengurangkan nominal uang secara akurat tanpa floating-point drift', () => {
    expect(addMoney(125000, 75000, 50000)).toBe(250000);
    expect(subtractMoney(500000, 185000)).toBe(315000);
  });

  it('memformat tampilan IDR dengan locale id-ID', () => {
    const formatted = formatIDR(1250000);
    // Intl.NumberFormat('id-ID') menghasilkan "Rp 1.250.000" (dengan spasi atau non-breaking space)
    expect(formatted.replace(/\s+/g, ' ')).toBe('Rp 1.250.000');
    expect(formatIDRPlain(1250000)).toBe('1.250.000');
  });

  it('mengurai string input berpemisah titik menjadi integer Rupiah', () => {
    expect(parseIDRInput('Rp 2.750.000')).toBe(2750000);
    expect(parseIDRInput('50.000')).toBe(50000);
    expect(parseIDRInput('')).toBe(0);
  });

  it('menghitung persentase pemakaian anggaran dengan tepat', () => {
    expect(calculatePercentage(800000, 1000000)).toBe(80);
    expect(calculatePercentage(250000, 0)).toBe(0);
  });

  it('memvalidasi skema Zod untuk integer Rupiah positif', () => {
    expect(positiveRupiahSchema.safeParse(10000).success).toBe(true);
    expect(positiveRupiahSchema.safeParse(0).success).toBe(false);
    expect(positiveRupiahSchema.safeParse(-5000).success).toBe(false);
    expect(positiveRupiahSchema.safeParse(1250.5).success).toBe(false);
  });
});

