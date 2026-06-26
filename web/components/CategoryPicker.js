"use client";

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import api from '@/services/api';
import { useLanguage } from '@/context/LanguageContext';

/**
 * CategoryPicker
 * Cascading drill-down category selector
 * Props:
 *   value: string (category name - the deepest selected)
 *   onChange: (name) => void
 *   className: string (optional, applied to container)
 */
export default function CategoryPicker({ value, onChange, className = '' }) {
  const { t, label } = useLanguage();
  const [tree, setTree] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [loadingTree, setLoadingTree] = useState(true);

  useEffect(() => {
    api.get('/categories/tree')
      .then(res => {
        if (res.data.success) setTree(res.data.data);
      })
      .catch(console.error)
      .finally(() => setLoadingTree(false));
  }, []);

  const currentLevel = breadcrumb.length === 0
    ? tree
    : breadcrumb[breadcrumb.length - 1].children;

  const handleSelect = (cat) => {
    const newBreadcrumb = [...breadcrumb, cat];
    setBreadcrumb(newBreadcrumb);
    onChange(cat.name);
  };

  const handleBack = () => {
    const newBreadcrumb = breadcrumb.slice(0, -1);
    setBreadcrumb(newBreadcrumb);
    onChange(newBreadcrumb.length > 0 ? newBreadcrumb[newBreadcrumb.length - 1].name : '');
  };

  const handleBreadcrumbClick = (idx) => {
    const newBreadcrumb = breadcrumb.slice(0, idx + 1);
    setBreadcrumb(newBreadcrumb);
    onChange(newBreadcrumb[newBreadcrumb.length - 1].name);
  };

  if (loadingTree) {
    return (
      <div className={`bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-4 text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-secondary)] opacity-50 ${className}`}>
        {t('common.loadingCategories')}
      </div>
    );
  }

  return (
    <div className={`bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl overflow-hidden ${className}`}>
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--glass-border)] flex-wrap">
        <button
          type="button"
          onClick={() => { setBreadcrumb([]); onChange(''); }}
          className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          {t('common.all')}
        </button>
        {breadcrumb.map((crumb, idx) => (
          <span key={crumb._id} className="flex items-center gap-1">
            <ChevronRight className="size-2.5 text-[var(--glass-border)]" />
            <button
              type="button"
              onClick={() => handleBreadcrumbClick(idx)}
              className={`text-[11px] lg:text-[12px] font-semibold tracking-tight transition-colors ${
                idx === breadcrumb.length - 1
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--accent)]'
              }`}
            >
              {label(crumb.name)}
            </button>
          </span>
        ))}
      </div>

      {breadcrumb.length > 0 && (
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1 px-4 py-2 text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors border-b border-[var(--glass-border)] w-full"
        >
          <ChevronLeft className="size-3" /> {t('common.back')}
        </button>
      )}

      <div className="max-h-52 overflow-y-auto no-scrollbar">
        {currentLevel.length === 0 ? (
          <p className="px-4 py-3 text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-secondary)] opacity-40">
            {t('common.noSubcategories', undefined, { value: label(value) })}
          </p>
        ) : (
          currentLevel.map(cat => (
            <button
              type="button"
              key={cat._id}
              onClick={() => handleSelect(cat)}
              className={`w-full text-left px-4 py-2.5 text-[11px] lg:text-[12px] font-semibold transition-colors flex items-center justify-between group border-b border-[var(--glass-border)]/30 last:border-0 ${
                value === cat.name
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]/50 hover:text-[var(--text-primary)]'
              }`}
            >
              <span>{label(cat.name)}</span>
              {cat.children && cat.children.length > 0 && (
                <ChevronRight className="size-3 opacity-40 group-hover:opacity-100 flex-shrink-0" />
              )}
            </button>
          ))
        )}
      </div>

      {value && (
        <div className="px-4 py-2 border-t border-[var(--glass-border)] bg-[var(--accent)]/5">
          <p className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--accent)]">
            {t('common.selected')}: {label(value)}
          </p>
        </div>
      )}
    </div>
  );
}
