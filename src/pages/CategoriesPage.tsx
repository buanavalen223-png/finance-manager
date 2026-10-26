import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Archive,
  ArchiveRestore,
  ArrowDownRight,
  ArrowUpRight,
  Pencil,
  Plus,
  Tags,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useAuth } from '@/hooks/useAuth';
import {
  categoryFormSchema,
  type CategoryFormValues,
} from '@/schemas/category.schema';
import {
  createCategory,
  ensureDefaultCategories,
  fetchCategories,
  setCategoryArchived,
  updateCategory,
} from '@/services/category.service';
import type { Category, CategoryType } from '@/types/domain';

const COLOR_PRESETS = [
  '#176B52',
  '#2B8A6E',
  '#2E5A4C',
  '#4E7D6E',
  '#789E90',
  '#3B6E5C',
  '#B85D3B',
  '#8C4A32',
];

export function CategoriesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | CategoryType>('all');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: '',
      type: 'expense',
      color: '#176B52',
      icon: 'tag',
    },
  });

  const selectedColor = watch('color');
  const selectedType = watch('type');

  const loadCategories = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await ensureDefaultCategories(user.id);
      const all = await fetchCategories(user.id, { includeArchived: true });
      setCategories(all);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal memuat kategori transaksi.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const visibleCategories = useMemo(() => {
    return categories.filter((c) => {
      if (!showArchived && c.isArchived) return false;
      if (activeTab !== 'all' && c.type !== activeTab) return false;
      return true;
    });
  }, [categories, showArchived, activeTab]);

  const openCreateModal = (defaultType: CategoryType = 'expense') => {
    setModalMode('create');
    setEditingCategory(null);
    reset({
      name: '',
      type: defaultType,
      color: '#176B52',
      icon: 'tag',
    });
    setModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setModalMode('edit');
    setEditingCategory(cat);
    reset({
      name: cat.name,
      type: cat.type,
      color: cat.color || '#176B52',
      icon: cat.icon || 'tag',
    });
    setModalOpen(true);
  };

  const onValidSubmit = async (values: CategoryFormValues) => {
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (modalMode === 'edit' && editingCategory) {
        const updated = await updateCategory(
          user.id,
          editingCategory.id,
          values,
        );
        showToast({
          title: 'Kategori Diperbarui',
          description: `Kategori "${updated.name}" berhasil disimpan.`,
          variant: 'success',
        });
      } else {
        const created = await createCategory(user.id, values);
        showToast({
          title: 'Kategori Kustom Ditambahkan',
          description: `Kategori "${created.name}" berhasil dibuat.`,
          variant: 'success',
        });
      }
      setModalOpen(false);
      await loadCategories();
    } catch (err) {
      showToast({
        title: 'Gagal Menyimpan Kategori',
        description:
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat menyimpan kategori.',
        variant: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleArchive = async (cat: Category) => {
    if (!user) return;
    try {
      const updated = await setCategoryArchived(
        user.id,
        cat.id,
        !cat.isArchived,
      );
      showToast({
        title: updated.isArchived
          ? 'Kategori Diarsipkan'
          : 'Kategori Dipulihkan',
        description: updated.isArchived
          ? `Kategori "${updated.name}" disembunyikan dari form input baru.`
          : `Kategori "${updated.name}" kembali aktif.`,
        variant: 'info',
      });
      await loadCategories();
    } catch (err) {
      showToast({
        title: 'Gagal Mengubah Status Kategori',
        description:
          err instanceof Error
            ? err.message
            : 'Tidak dapat mengubah status arsip kategori.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-surface p-5 shadow-subtle lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Kategori Transaksi
            </h2>
            <Badge variant="brand">Default &amp; Kustom</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Kelola kategori bawaan sistem maupun kategori kustom untuk pemasukan
            dan pengeluaran Anda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived((prev) => !prev)}
          >
            {showArchived ? 'Sembunyikan Arsip' : 'Tampilkan Arsip'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              openCreateModal(activeTab === 'income' ? 'income' : 'expense')
            }
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Tambah Kategori Kustom
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle>Daftar Kategori ({visibleCategories.length})</CardTitle>
            <CardDescription>
              Kategori yang diarsipkan tetap menjaga keutuhan transaksi
              historis.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', label: 'Semua' },
                { id: 'expense', label: 'Pengeluaran' },
                { id: 'income', label: 'Pemasukan' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-brand text-brand-foreground'
                    : 'bg-surface-muted text-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : errorMsg ? (
            <ErrorState
              title="Gagal Memuat Kategori"
              message={errorMsg}
              onRetry={() => void loadCategories()}
            />
          ) : visibleCategories.length === 0 ? (
            <EmptyState
              icon={Tags}
              title="Belum Ada Kategori"
              description="Tambahkan kategori kustom untuk mengelompokkan pemasukan atau pengeluaran Anda."
              actionLabel="Tambah Kategori"
              onAction={() => openCreateModal('expense')}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCategories.map((cat) => (
                <div
                  key={cat.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5 ${
                    cat.isArchived ? 'opacity-65' : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white"
                      style={{ backgroundColor: cat.color || '#176B52' }}
                    >
                      {cat.type === 'income' ? (
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {cat.name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={
                            cat.type === 'income' ? 'income' : 'expense'
                          }
                        >
                          {cat.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                        </Badge>
                        <Badge variant="default">
                          {cat.isSystem ? 'Default' : 'Kustom'}
                        </Badge>
                        {cat.isArchived ? (
                          <Badge variant="warning">Arsip</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(cat)}
                      aria-label={`Edit kategori ${cat.name}`}
                      title="Edit kategori"
                      className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleArchive(cat)}
                      aria-label={
                        cat.isArchived
                          ? `Pulihkan kategori ${cat.name}`
                          : `Arsipkan kategori ${cat.name}`
                      }
                      title={
                        cat.isArchived
                          ? 'Pulihkan kategori'
                          : 'Arsipkan kategori'
                      }
                      className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
                    >
                      {cat.isArchived ? (
                        <ArchiveRestore
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      ) : (
                        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={modalOpen}
        onClose={isSubmitting ? () => undefined : () => setModalOpen(false)}
        title={
          modalMode === 'edit' ? 'Edit Kategori' : 'Tambah Kategori Kustom'
        }
        description="Pilih jenis pemasukan atau pengeluaran serta warna identitas untuk laporan grafik."
      >
        <form
          onSubmit={handleSubmit(onValidSubmit)}
          className="space-y-4"
          noValidate
        >
          <div>
            <label
              htmlFor="cat-name"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Nama Kategori
            </label>
            <Input
              id="cat-name"
              disabled={isSubmitting}
              placeholder="Contoh: Langganan Cloud, Royalti, atau Kopi"
              {...register('name')}
            />
            {errors.name ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {errors.name.message}
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Jenis Kategori
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'expense', label: 'Pengeluaran' },
                  { value: 'income', label: 'Pemasukan' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() =>
                    setValue('type', opt.value, { shouldValidate: true })
                  }
                  className={`h-9 rounded-md border text-xs font-medium transition-colors ${
                    selectedType === opt.value
                      ? 'border-brand bg-brand-soft text-brand-soft-foreground'
                      : 'border-border bg-surface text-muted hover:bg-surface-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Warna Kategori
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() =>
                    setValue('color', hex, { shouldValidate: true })
                  }
                  aria-label={`Pilih warna ${hex}`}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    selectedColor === hex
                      ? 'scale-110 border-foreground'
                      : 'border-transparent opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Kategori'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
