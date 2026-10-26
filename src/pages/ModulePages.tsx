import { Bot, FileBarChart2 } from 'lucide-react';
import { ModuleFoundationView } from '@/components/common/ModuleFoundationView';

export function ReportsPage() {
  return (
    <ModuleFoundationView
      title="Laporan Keuangan & Ekspor Data"
      subtitle="Visualisasi arus kas periodik dengan Recharts dan ekspor buku besar ke format CSV."
      milestone="Milestone 5"
      icon={FileBarChart2}
      tableName="public.transactions (Aggregated)"
      plannedFeatures={[
        'Grafik perbandingan Pemasukan vs Pengeluaran dan distribusi pengeluaran per kategori.',
        'Filter laporan berdasarkan periode bulan, tahun, atau rentang tanggal kustom.',
        'Unduh laporan transaksi terfilter ke file CSV standar.',
      ]}
      invariants={[
        'Seluruh angka laporan dihitung murni dari transaksi aktual pengguna yang terautentikasi.',
        'Data CSV disanitasi terhadap formula injection sebelum diunduh.',
      ]}
    />
  );
}

export function AIAssistantPage() {
  return (
    <ModuleFoundationView
      title="AI Financial Assistant & Transaction Drafting"
      subtitle="Tanya jawab kondisi keuangan kontekstual dan ubah kalimat sehari-hari menjadi draf transaksi terstruktur."
      milestone="Milestone 6"
      icon={Bot}
      tableName="Server-Side /api/ai/*"
      plannedFeatures={[
        'Percakapan asisten keuangan yang memahami konteks anggaran dan pengeluaran pengguna.',
        'Ekstraksi kalimat bebas (mis. "Makan siang 35rb pakai GoPay") menjadi draf transaksi terstruktur.',
        'Antarmuka Review & Confirm agar pengguna meninjau dan menyetujui draf sebelum disimpan ke database.',
      ]}
      invariants={[
        'Seluruh pemanggilan AI wajib melalui endpoint server-side; API key tidak pernah berada di browser.',
        'AI dilarang menulis langsung ke database tanpa konfirmasi eksplisit pengguna (Human-in-the-Loop).',
      ]}
    />
  );
}

