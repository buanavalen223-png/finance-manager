/**
 * Utilitas pemformatan tanggal dan periode laporan dengan locale 'id-ID'.
 */

const dateFormatterMedium = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const monthYearFormatter = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
});

/**
 * Memformat tanggal ISO atau objek Date menjadi format pendek Indonesia (contoh: "26 Okt 2026").
 */
export function formatDateID(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return dateFormatterMedium.format(date);
}

/**
 * Memformat bulan dan tahun (1-12, YYYY) ke nama bulan Indonesia (contoh: "Oktober 2026").
 */
export function formatMonthYearID(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return monthYearFormatter.format(date);
}

/**
 * Mengembalikan periode bulan dan tahun saat ini beserta label bahasa Indonesia.
 */
export function getCurrentMonthPeriod(referenceDate: Date = new Date()): {
  month: number;
  year: number;
  label: string;
} {
  const month = referenceDate.getMonth() + 1;
  const year = referenceDate.getFullYear();
  return {
    month,
    year,
    label: formatMonthYearID(month, year),
  };
}

/**
 * Mengembalikan string tanggal format YYYY-MM-DD untuk nilai default input date.
 */
export function toISODateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

