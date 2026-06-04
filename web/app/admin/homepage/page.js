"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  EyeOff,
  Grid3X3,
  ImageIcon,
  Layers,
  MonitorPlay,
  Package,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Store,
  Tag,
  Trash2,
} from 'lucide-react';
import api from '@/services/api';
import SectionForm from '../storefront/components/SectionForm';
import { toast } from 'react-hot-toast';

const sectionTypes = [
  { value: 'all', label: 'All' },
  { value: 'hero', label: 'Hero' },
  { value: 'categories', label: 'Categories' },
  { value: 'featured_products', label: 'Featured' },
  { value: 'trending', label: 'Trending' },
  { value: 'stores', label: 'Stores' },
  { value: 'promo_banner', label: 'Promo' },
];

const typeMeta = {
  hero: { label: 'Hero', icon: MonitorPlay },
  categories: { label: 'Categories', icon: Tag },
  featured_products: { label: 'Featured', icon: Sparkles },
  trending: { label: 'Trending', icon: Activity },
  stores: { label: 'Stores', icon: Store },
  promo_banner: { label: 'Promo', icon: ImageIcon },
  collection: { label: 'Collection', icon: Layers },
  recommendations: { label: 'Recommendations', icon: Grid3X3 },
  footer_promo: { label: 'Footer Promo', icon: ImageIcon },
};

const formatType = (type = '') => typeMeta[type]?.label || type.replace(/_/g, ' ') || 'Section';

const getItemTitle = (section, item) => {
  const vendorName = item.vendor_id?.store_name || item.vendor_name;
  const productName = item.product_id?.name || item.product_name;
  return item.headline || item.category_name || productName || vendorName || formatType(section.type);
};

const getItemSubtitle = (section, item) => {
  if (item.subtext) return item.subtext;
  if (item.product_id?.price) return `${Number(item.product_id.price).toLocaleString()} XAF`;
  if (section.type === 'stores') return 'Vendor profile';
  if (item.link_to) return item.link_to;
  return 'Homepage item';
};

const getItemImage = (section, item) => {
  if (item.image_url) return item.image_url;
  if (item.product_id?.images?.[0]?.url) return item.product_id.images[0].url;
  if (section.type === 'stores') {
    return item.vendor_id?.store?.banner ||
      item.vendor_id?.store?.logo ||
      item.vendor_id?.user_id?.branding?.banner ||
      item.vendor_id?.user_id?.branding?.logo ||
      item.vendor_logo;
  }
  return null;
};

function SectionIcon({ type }) {
  const Icon = typeMeta[type]?.icon || Package;
  return <Icon className="size-4" />;
}

function StatCard({ label, value, tone = 'text-[var(--text-primary)]', icon: Icon }) {
  return (
    <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{label}</span>
        <Icon className={`size-4 ${tone}`} />
      </div>
      <p className={`text-2xl font-semibold leading-none tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}

function PreviewCard({ section, item }) {
  const title = getItemTitle(section, item);
  const image = getItemImage(section, item);

  return (
    <div className="w-[150px] shrink-0 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-2 shadow-sm sm:w-[178px]">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[var(--bg-secondary)]">
        {image ? (
          <img src={image} alt={title} className="size-full object-cover" loading="lazy" />
        ) : item.category_name ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
            <Tag className="size-5 text-[var(--accent)]" />
            <span className="max-w-[90%] truncate text-[10px] font-semibold">{item.category_name}</span>
          </div>
        ) : (
          <div className="flex size-full items-center justify-center text-[var(--text-secondary)]">
            <ImageIcon className="size-5 opacity-50" />
          </div>
        )}
      </div>
      <div className="mt-2 min-w-0">
        <p className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="mt-0.5 truncate text-[10px] font-medium text-[var(--text-secondary)]">{getItemSubtitle(section, item)}</p>
      </div>
    </div>
  );
}

function SectionRow({ section, index, total, onMove, onToggle, onEdit, onDelete }) {
  const active = Boolean(section.is_active);
  const itemCount = section.data?.length || 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="border-b border-[var(--glass-border)] p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-start gap-3">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${active ? 'border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
              <SectionIcon type={section.type} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">
                  #{index + 1}
                </span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}>
                  {active ? 'Live' : 'Hidden'}
                </span>
              </div>
              <h2 className="mt-2 truncate text-base font-semibold tracking-tight text-[var(--text-primary)]">
                {section.title || formatType(section.type)}
              </h2>
              <p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">
                {formatType(section.type)} · {itemCount} item{itemCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
            <div className="flex rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-1">
              <button
                type="button"
                onClick={() => onMove(index, -1)}
                disabled={index === 0}
                className="flex size-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--bg-primary)] hover:text-[var(--accent)] disabled:opacity-30"
                aria-label="Move section up"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onMove(index, 1)}
                disabled={index === total - 1}
                className="flex size-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--bg-primary)] hover:text-[var(--accent)] disabled:opacity-30"
                aria-label="Move section down"
              >
                <ArrowDown className="size-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => onEdit(section)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-[11px] font-semibold text-[var(--bg-primary)] transition active:scale-[0.98]"
            >
              <Settings2 className="size-4" />
              Edit
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onToggle(section._id, active)}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-[11px] font-semibold transition ${active ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}
            >
              {active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              {active ? 'Visible' : 'Hidden'}
            </button>
            <button
              type="button"
              onClick={() => onDelete(section._id)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 text-[11px] font-semibold text-rose-500 transition hover:bg-rose-500 hover:text-white"
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          </div>
        </div>

        <div className="min-w-0 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-[var(--text-secondary)]">Preview</p>
            {section.scheduled_start && (
              <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-500">
                Scheduled
              </span>
            )}
          </div>

          {itemCount > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              {section.data.map((item, itemIndex) => (
                <PreviewCard key={`${section._id}-${itemIndex}`} section={section} item={item} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[132px] items-center justify-center rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 p-6 text-center">
              <div>
                <Grid3X3 className="mx-auto mb-2 size-6 text-[var(--text-secondary)] opacity-50" />
                <p className="text-[12px] font-semibold text-[var(--text-secondary)]">No items added yet</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function AdminHomepagePage() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchSections = async () => {
    try {
      const res = await api.get('/homepage/admin/sections');
      if (res.data?.success) {
        setSections(res.data.data.sections || []);
      }
    } catch (err) {
      console.error('Failed to fetch sections:', err);
      toast.error('Failed to load homepage sections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const handleToggle = async (id, currentStatus) => {
    try {
      await api.patch(`/homepage/admin/sections/${id}`, { is_active: !currentStatus });
      fetchSections();
      toast.success('Section status updated');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this homepage section?')) return;
    try {
      await api.delete(`/homepage/admin/sections/${id}`);
      fetchSections();
      toast.success('Section deleted');
    } catch (err) {
      toast.error('Failed to delete section');
    }
  };

  const handleMove = async (index, direction) => {
    const newSections = [...sections];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const [removed] = newSections.splice(index, 1);
    newSections.splice(targetIndex, 0, removed);

    const orders = newSections.map((section, orderIndex) => ({ id: section._id, order: orderIndex + 1 }));
    setSections(newSections);

    try {
      await api.patch('/homepage/admin/sections/reorder', { orders });
    } catch (err) {
      toast.error('Failed to reorder sections');
      fetchSections();
    }
  };

  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sections.filter((section) => {
      const matchesType = typeFilter === 'all' || section.type === typeFilter;
      if (!matchesType) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        section.title,
        section.subtitle,
        section.type,
        ...(section.data || []).flatMap((item) => [
          item.headline,
          item.category_name,
          item.product_name,
          item.product_id?.name,
          item.vendor_name,
          item.vendor_id?.store_name,
        ]),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [sections, query, typeFilter]);

  const stats = useMemo(() => ({
    total: sections.length,
    live: sections.filter((section) => section.is_active).length,
    scheduled: sections.filter((section) => section.scheduled_start).length,
    items: sections.reduce((sum, section) => sum + (section.data?.length || 0), 0),
  }), [sections]);

  return (
    <main className="min-h-screen bg-[var(--bg-secondary)] px-3 py-4 font-[var(--font-poppins)] text-[var(--text-primary)] sm:px-5 lg:px-8">
      <div className="w-full space-y-5">
        <header className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-sm">
                <MonitorPlay className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Admin homepage</p>
                <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">Storefront sections</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setEditingSection(null); setIsFormOpen(true); }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-[12px] font-semibold text-[var(--bg-primary)] shadow-sm transition active:scale-[0.98]"
            >
              <Plus className="size-4" />
              New section
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Sections" value={stats.total} icon={Layers} />
          <StatCard label="Live" value={stats.live} icon={CheckCircle2} tone="text-emerald-600" />
          <StatCard label="Scheduled" value={stats.scheduled} icon={Activity} tone="text-blue-500" />
          <StatCard label="Items" value={stats.items} icon={Package} tone="text-[var(--accent)]" />
        </section>

        <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-3 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <label className="flex h-11 items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3">
              <Search className="size-4 shrink-0 text-[var(--text-secondary)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search sections, products, categories, vendors"
                className="min-w-0 flex-1 bg-transparent !text-base font-medium outline-none placeholder:text-[var(--text-secondary)]"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {sectionTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setTypeFilter(type.value)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-[11px] font-semibold transition ${typeFilter === type.value ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-44 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-sm" />
            ))
          ) : filteredSections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-primary)] p-10 text-center shadow-sm">
              <MonitorPlay className="mx-auto mb-3 size-9 text-[var(--text-secondary)] opacity-50" />
              <h2 className="text-base font-semibold">No sections found</h2>
              <p className="mt-1 text-[12px] font-medium text-[var(--text-secondary)]">Create a section or adjust your filters.</p>
            </div>
          ) : (
            filteredSections.map((section) => {
              const sourceIndex = sections.findIndex((item) => item._id === section._id);
              return (
                <SectionRow
                  key={section._id}
                  section={section}
                  index={sourceIndex}
                  total={sections.length}
                  onMove={handleMove}
                  onToggle={handleToggle}
                  onEdit={(selected) => { setEditingSection(selected); setIsFormOpen(true); }}
                  onDelete={handleDelete}
                />
              );
            })
          )}
        </section>

        {isFormOpen && (
          <SectionForm
            section={editingSection}
            onClose={() => setIsFormOpen(false)}
            onSuccess={() => { setIsFormOpen(false); fetchSections(); }}
          />
        )}
      </div>
    </main>
  );
}
