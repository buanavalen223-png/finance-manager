/**
 * ============================================================================
 * ISOLATED DEMO FIXTURE DATA (MILESTONE 1 — UI & DESIGN SYSTEM)
 * ============================================================================
 * PENTING:
 * - Data di file ini HANYA digunakan sebagai fixture visual terisolasi untuk
 *   mendemonstrasikan UI Dashboard pada Milestone 1.
 * - DILARANG mencampur file ini dengan query Supabase produksi di `src/services/`.
 * - Seluruh nilai uang direpresentasikan sebagai integer Rupiah (IDR).
 * ============================================================================
 */

import type { TransactionType, WalletType } from '@/types/domain';

export const DEMO_DATASET_METADATA = {
  isDemoFixture: true as const,
  badgeText: 'DATA DEMO TERISOLASI',
  periodLabel: 'Oktober 2026',
  notice:
    'Data di bawah ini adalah fixture demo yang terisolasi di memori lokal untuk pratinjau UI Milestone 1 dan tidak terhubung ke database produksi.',
};

export interface DemoWallet {
  id: string;
  name: string;
  type: WalletType;
  balance: number; // Integer Rupiah
}

export interface DemoCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
}

export interface DemoTransaction {
  id: string;
  type: TransactionType;
  amount: number; // Integer Rupiah
  walletId: string;
  destinationWalletId?: string;
  categoryId?: string;
  description: string;
  transactionDate: string; // YYYY-MM-DD
}

export interface DemoBudget {
  id: string;
  categoryId: string;
  amountLimit: number; // Integer Rupiah
  alertThresholdPercent: number;
}

export interface DemoCashflowPoint {
  month: string;
  income: number; // Integer Rupiah
  expense: number; // Integer Rupiah
}

export interface DemoAIInsight {
  id: string;
  title: string;
  summary: string;
  tag: 'Rasio Tabungan' | 'Peringatan Anggaran' | 'Optimasi Kas';
  tone: 'positive' | 'warning' | 'neutral';
}

export const INITIAL_DEMO_WALLETS: DemoWallet[] = [
  {
    id: 'wallet-bca',
    name: 'BCA Prioritas Utama',
    type: 'bank',
    balance: 14250000,
  },
  {
    id: 'wallet-mandiri',
    name: 'Tabungan Mandiri',
    type: 'bank',
    balance: 18500000,
  },
  {
    id: 'wallet-gopay',
    name: 'GoPay Harian',
    type: 'ewallet',
    balance: 1450000,
  },
  {
    id: 'wallet-cash',
    name: 'Kas Tunai',
    type: 'cash',
    balance: 650000,
  },
];

export const INITIAL_DEMO_CATEGORIES: DemoCategory[] = [
  { id: 'cat-salary', name: 'Gaji & Utama', type: 'income', color: '#176B52' },
  { id: 'cat-freelance', name: 'Proyek Freelance', type: 'income', color: '#2B8A6E' },
  { id: 'cat-food', name: 'Makanan & Kopi', type: 'expense', color: '#176B52' },
  { id: 'cat-housing', name: 'Hunian & Utilitas', type: 'expense', color: '#2E5A4C' },
  { id: 'cat-transport', name: 'Transportasi', type: 'expense', color: '#4E7D6E' },
  { id: 'cat-shopping', name: 'Kebutuhan Rumah', type: 'expense', color: '#789E90' },
  { id: 'cat-health', name: 'Kesehatan & Olahraga', type: 'expense', color: '#A3BFB5' },
];

export const INITIAL_DEMO_TRANSACTIONS: DemoTransaction[] = [
  {
    id: 'tx-101',
    type: 'income',
    amount: 12500000,
    walletId: 'wallet-bca',
    categoryId: 'cat-salary',
    description: 'Gaji Bulanan Oktober',
    transactionDate: '2026-10-25',
  },
  {
    id: 'tx-102',
    type: 'expense',
    amount: 1650000,
    walletId: 'wallet-bca',
    categoryId: 'cat-housing',
    description: 'Tagihan Listrik, Air & Internet Fiber',
    transactionDate: '2026-10-24',
  },
  {
    id: 'tx-103',
    type: 'transfer',
    amount: 2500000,
    walletId: 'wallet-bca',
    destinationWalletId: 'wallet-mandiri',
    description: 'Alokasi Rutin Dana Darurat',
    transactionDate: '2026-10-24',
  },
  {
    id: 'tx-104',
    type: 'expense',
    amount: 1680000,
    walletId: 'wallet-gopay',
    categoryId: 'cat-food',
    description: 'Belanja Bahan Makanan Mingguan & Kopi',
    transactionDate: '2026-10-23',
  },
  {
    id: 'tx-105',
    type: 'income',
    amount: 3200000,
    walletId: 'wallet-bca',
    categoryId: 'cat-freelance',
    description: 'Pelunasan Desain Sistem Klien',
    transactionDate: '2026-10-21',
  },
  {
    id: 'tx-106',
    type: 'expense',
    amount: 540000,
    walletId: 'wallet-gopay',
    categoryId: 'cat-transport',
    description: 'Komuter MRT, Bensin & Tol Dalam Kota',
    transactionDate: '2026-10-20',
  },
  {
    id: 'tx-107',
    type: 'expense',
    amount: 850000,
    walletId: 'wallet-bca',
    categoryId: 'cat-shopping',
    description: 'Perlengkapan Rumah Tangga Bulanan',
    transactionDate: '2026-10-18',
  },
  {
    id: 'tx-108',
    type: 'expense',
    amount: 420000,
    walletId: 'wallet-cash',
    categoryId: 'cat-health',
    description: 'Vitamin & Pemeriksaan Rutin',
    transactionDate: '2026-10-15',
  },
];

export const INITIAL_DEMO_BUDGETS: DemoBudget[] = [
  {
    id: 'bgt-food',
    categoryId: 'cat-food',
    amountLimit: 2000000, // Terpakai 1.680.000 (84% - Warning)
    alertThresholdPercent: 80,
  },
  {
    id: 'bgt-housing',
    categoryId: 'cat-housing',
    amountLimit: 2200000, // Terpakai 1.650.000 (75% - Aman)
    alertThresholdPercent: 80,
  },
  {
    id: 'bgt-shopping',
    categoryId: 'cat-shopping',
    amountLimit: 1200000, // Terpakai 850.000 (70.8% - Aman)
    alertThresholdPercent: 80,
  },
  {
    id: 'bgt-transport',
    categoryId: 'cat-transport',
    amountLimit: 800000, // Terpakai 540.000 (67.5% - Aman)
    alertThresholdPercent: 80,
  },
];

export const INITIAL_DEMO_CASHFLOW_SERIES: DemoCashflowPoint[] = [
  { month: 'Mei', income: 13200000, expense: 6400000 },
  { month: 'Jun', income: 12500000, expense: 5900000 },
  { month: 'Jul', income: 14800000, expense: 6850000 },
  { month: 'Agu', income: 12500000, expense: 5400000 },
  { month: 'Sep', income: 13900000, expense: 6100000 },
  { month: 'Okt', income: 15700000, expense: 5140000 },
];

export const INITIAL_DEMO_AI_INSIGHTS: DemoAIInsight[] = [
  {
    id: 'ins-1',
    title: 'Surplus Arus Kas Terjaga (67,3%)',
    summary:
      'Arus kas bersih bulan ini positif sebesar Rp 10.560.000. Transfer internal Rp 2.500.000 ke Tabungan Mandiri tidak dihitung sebagai pengeluaran.',
    tag: 'Rasio Tabungan',
    tone: 'positive',
  },
  {
    id: 'ins-2',
    title: 'Anggaran Makanan & Kopi Mencapai 84%',
    summary:
      'Realisasi pos Makanan & Kopi telah mencapai Rp 1.680.000 dari batas Rp 2.000.000. Tersisa ruang Rp 320.000 untuk sisa bulan ini.',
    tag: 'Peringatan Anggaran',
    tone: 'warning',
  },
];

