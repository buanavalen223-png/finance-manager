/**
 * Utilitas aritmetika dan pemformatan uang berbasis integer Rupiah (IDR).
 *
 * ATURAN FINANSIAL FINORA AI:
 * - Seluruh nilai uang direpresentasikan sebagai bilangan bulat (safe integer)
 *   dalam satuan Rupiah terkecil yang sesuai (Rp 1), BUKAN floating-point.
 * - Tampilan mata uang diformat dengan locale 'id-ID'.
 */

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const idrNumberFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Memastikan nilai adalah integer aman (safe integer) untuk perhitungan Rupiah.
 * Melempar Error jika nilai bukan angka finit atau melebihi Number.MAX_SAFE_INTEGER.
 */
export function toSafeRupiahInteger(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Nilai nominal uang harus berupa angka yang valid.');
  }
  const rounded = Math.round(value);
  if (!Number.isSafeInteger(rounded)) {
    throw new Error('Nilai nominal uang melebihi batas integer aman.');
  }
  return rounded;
}

/**
 * Menjumlahkan dua atau lebih nominal uang dalam integer Rupiah secara aman.
 */
export function addMoney(...amounts: number[]): number {
  return amounts.reduce((total, current) => {
    const safeTotal = toSafeRupiahInteger(total);
    const safeCurrent = toSafeRupiahInteger(current);
    return toSafeRupiahInteger(safeTotal + safeCurrent);
  }, 0);
}

/**
 * Mengurangkan nominal pengurang dari nominal utama dalam integer Rupiah secara aman.
 */
export function subtractMoney(baseAmount: number, subtrahend: number): number {
  const safeBase = toSafeRupiahInteger(baseAmount);
  const safeSub = toSafeRupiahInteger(subtrahend);
  return toSafeRupiahInteger(safeBase - safeSub);
}

/**
 * Menghitung persentase pemakaian (mis. realisasi anggaran atau target tabungan)
 * menggunakan pembulatan satu desimal yang stabil.
 */
export function calculatePercentage(currentAmount: number, targetAmount: number): number {
  const safeCurrent = toSafeRupiahInteger(currentAmount);
  const safeTarget = toSafeRupiahInteger(targetAmount);
  if (safeTarget <= 0) {
    return 0;
  }
  return Math.round((safeCurrent / safeTarget) * 1000) / 10;
}

/**
 * Memformat integer Rupiah ke format mata uang standar Indonesia (contoh: "Rp 1.250.000").
 */
export function formatIDR(amount: number, options?: { showSign?: boolean }): string {
  const safeAmount = toSafeRupiahInteger(amount);
  const formatted = idrFormatter.format(Math.abs(safeAmount));

  if (safeAmount < 0) {
    return `-${formatted}`;
  }
  if (options?.showSign && safeAmount > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

/**
 * Memformat integer Rupiah menjadi angka berpemisah titik tanpa simbol Rp (contoh: "1.250.000").
 */
export function formatIDRPlain(amount: number): string {
  const safeAmount = toSafeRupiahInteger(amount);
  return idrNumberFormatter.format(safeAmount);
}

/**
 * Mengurai string input pengguna (mis. "1.500.000" atau "Rp 250.000") menjadi integer Rupiah.
 * Mengembalikan 0 jika input kosong atau tidak memiliki digit.
 */
export function parseIDRInput(rawInput: string): number {
  const digitsOnly = rawInput.replace(/[^\d]/g, '');
  if (!digitsOnly) {
    return 0;
  }
  const parsed = Number.parseInt(digitsOnly, 10);
  return toSafeRupiahInteger(parsed);
}

