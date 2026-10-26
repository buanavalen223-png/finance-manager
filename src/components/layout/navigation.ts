import {
  ArrowLeftRight,
  Bot,
  CalendarClock,
  FileBarChart2,
  HandCoins,
  LayoutDashboard,
  PieChart,
  PiggyBank,
  Settings,
  Tags,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  section: 'utama' | 'perencanaan' | 'inteligensi';
  milestoneTarget: string;
  shortDescription: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    section: 'utama',
    milestoneTarget: 'M5',
    shortDescription: 'Ringkasan saldo, arus kas bersih, dan grafik keuangan bulanan.',
  },
  {
    label: 'Transaksi',
    path: '/transaksi',
    icon: ArrowLeftRight,
    section: 'utama',
    milestoneTarget: 'M3',
    shortDescription: 'Catatan pemasukan, pengeluaran, dan transfer antar-rekening secara atomik.',
  },
  {
    label: 'Rekening & Dompet',
    path: '/dompet',
    icon: Wallet,
    section: 'utama',
    milestoneTarget: 'M3',
    shortDescription: 'Kelola rekening bank, e-wallet, dan kas tunai beserta rekonsiliasi saldo.',
  },
  {
    label: 'Kategori',
    path: '/kategori',
    icon: Tags,
    section: 'utama',
    milestoneTarget: 'M3',
    shortDescription: 'Klasifikasi pemasukan dan pengeluaran bawaan maupun kustom.',
  },
  {
    label: 'Anggaran',
    path: '/anggaran',
    icon: PieChart,
    section: 'perencanaan',
    milestoneTarget: 'M4',
    shortDescription: 'Batas alokasi pengeluaran bulanan per kategori dan pemantauan realisasi.',
  },
  {
    label: 'Target Tabungan',
    path: '/tabungan',
    icon: PiggyBank,
    section: 'perencanaan',
    milestoneTarget: 'M4',
    shortDescription: 'Perencanaan dana darurat dan tujuan finansial beserta progres alokasi.',
  },
  {
    label: 'Utang & Piutang',
    path: '/utang-piutang',
    icon: HandCoins,
    section: 'perencanaan',
    milestoneTarget: 'M4',
    shortDescription: 'Lacak kewajiban utang dan tagihan piutang beserta riwayat cicilan.',
  },
  {
    label: 'Tagihan Berulang',
    path: '/tagihan-berulang',
    icon: CalendarClock,
    section: 'perencanaan',
    milestoneTarget: 'M4',
    shortDescription: 'Jadwal pembayaran rutin dan eksekusi transaksi berkala.',
  },
  {
    label: 'Laporan & Ekspor',
    path: '/laporan',
    icon: FileBarChart2,
    section: 'inteligensi',
    milestoneTarget: 'M5',
    shortDescription: 'Analitik mendalam arus kas per periode dan unduh data format CSV.',
  },
  {
    label: 'AI Assistant',
    path: '/ai-assistant',
    icon: Bot,
    section: 'inteligensi',
    milestoneTarget: 'M6',
    shortDescription: 'Asisten finansial cerdas dan pembuatan draf transaksi dengan konfirmasi pengguna.',
  },
  {
    label: 'Pengaturan',
    path: '/pengaturan',
    icon: Settings,
    section: 'inteligensi',
    milestoneTarget: 'M1/M2',
    shortDescription: 'Preferensi profil, tampilan tema Terang/Gelap, dan diagnostik koneksi sistem.',
  },
];

