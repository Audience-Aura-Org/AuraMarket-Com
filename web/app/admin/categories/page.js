"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, ChevronRight, ChevronDown,
  FolderOpen, Folder, Check, X, Search, RefreshCw,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

// ── Tree helpers ─────────────────────────────────────────────────────────────
function removeById(cats, id) {
  return cats
    .filter(c => c._id !== id)
    .map(c => ({ ...c, children: removeById(c.children || [], id) }));
}

function addChild(cats, parentId, newCat) {
  return cats.map(c => {
    if (c._id === parentId) return { ...c, children: [...(c.children || []), newCat] };
    return { ...c, children: addChild(c.children || [], parentId, newCat) };
  });
}

function updateById(cats, id, updates) {
  return cats.map(c => {
    if (c._id === id) return { ...c, ...updates };
    return { ...c, children: updateById(c.children || [], id, updates) };
  });
}

function replaceTemp(cats, tempId, real) {
  return cats.map(c => {
    if (c._id === tempId) return { ...real, children: c.children || [] };
    return { ...c, children: replaceTemp(c.children || [], tempId, real) };
  });
}

function filterTree(cats, q) {
  if (!q) return cats;
  const lq = q.toLowerCase();
  return cats.reduce((acc, c) => {
    const childMatches = filterTree(c.children || [], lq);
    if (c.name.toLowerCase().includes(lq) || childMatches.length > 0) {
      acc.push({ ...c, children: childMatches });
    }
    return acc;
  }, []);
}

function countAll(cats) {
  return cats.reduce((n, c) => n + 1 + countAll(c.children || []), 0);
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  // undefined = closed  |  null = top-level  |  string = sub of that id
  const [addParentId, setAddParentId] = useState(undefined);
  const [addName, setAddName] = useState('');
  const [query, setQuery] = useState('');

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/categories/tree');
      if (res.data.success) setCategories(res.data.data);
    } catch {
      toast.error('Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const openAdd = (parentId = null) => {
    setAddParentId(parentId);
    setAddName('');
    if (parentId) setExpanded(prev => ({ ...prev, [parentId]: true }));
  };
  const closeAdd = () => { setAddParentId(undefined); setAddName(''); };

  // ── Add (optimistic) ───────────────────────────────────────────────────────
  const handleAdd = async () => {
    const name = addName.trim();
    if (!name) return;

    const tempId = `temp-${Date.now()}`;
    const newCat = { _id: tempId, name, children: [] };

    setCategories(prev =>
      addParentId === null ? [...prev, newCat] : addChild(prev, addParentId, newCat)
    );
    closeAdd();

    try {
      const res = await api.post('/categories', { name, parent_id: addParentId });
      if (res.data.success) {
        setCategories(prev => replaceTemp(prev, tempId, res.data.data));
      }
    } catch (err) {
      setCategories(prev => removeById(prev, tempId));
      toast.error(err.response?.data?.error || 'Failed to add category.');
    }
  };

  // ── Edit (optimistic) ──────────────────────────────────────────────────────
  const startEdit = (cat) => { setEditingId(cat._id); setEditName(cat.name); };
  const cancelEdit = () => { setEditingId(null); setEditName(''); };

  const handleUpdate = async () => {
    const name = editName.trim();
    if (!name) return;
    const snapshot = categories;
    const id = editingId;
    setCategories(prev => updateById(prev, id, { name }));
    cancelEdit();
    try {
      await api.put(`/categories/${id}`, { name });
    } catch (err) {
      setCategories(snapshot);
      toast.error(err.response?.data?.error || 'Failed to update.');
    }
  };

  // ── Delete (optimistic) ────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Delete this category? Subcategories will also be removed.')) return;
    const snapshot = categories;
    setCategories(prev => removeById(prev, id));
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Category deleted.');
    } catch (err) {
      setCategories(snapshot);
      toast.error(err.response?.data?.error || 'Failed to delete.');
    }
  };

  const filtered = useMemo(() => filterTree(categories, query), [categories, query]);
  const total = useMemo(() => countAll(categories), [categories]);

  // ── Row renderer ───────────────────────────────────────────────────────────
  const renderRow = (cat, depth = 0) => {
    const isExpanded = expanded[cat._id];
    const hasChildren = (cat.children || []).length > 0;
    const isEditing = editingId === cat._id;
    const isAddingHere = addParentId === cat._id;

    return (
      <div key={cat._id}>
        <div
          className="flex items-center gap-2 py-2.5 border-b border-[var(--glass-border)]/40 hover:bg-[var(--accent)]/5 transition-colors group"
          style={{ paddingLeft: `${depth * 20 + 12}px`, paddingRight: '12px' }}
        >
          {/* Chevron */}
          <button
            type="button"
            onClick={() => hasChildren && setExpanded(p => ({ ...p, [cat._id]: !p[cat._id] }))}
            className={`size-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
              hasChildren
                ? 'text-[var(--text-secondary)] hover:text-[var(--accent)]'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>

          {/* Folder icon */}
          <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${
            depth === 0
              ? 'text-[var(--accent)] bg-[var(--accent)]/10'
              : 'text-[var(--text-secondary)] opacity-40'
          }`}>
            {isExpanded && hasChildren ? <FolderOpen className="size-4" /> : <Folder className="size-4" />}
          </div>

          {/* Name or edit input */}
          {isEditing ? (
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') cancelEdit(); }}
              autoFocus
              className="flex-1 h-8 bg-[var(--bg-secondary)] border border-[var(--accent)] rounded-lg px-3 text-[12px] font-semibold outline-none capitalize"
            />
          ) : (
            <span className="flex-1 text-[12px] sm:text-[13px] font-semibold text-[var(--text-primary)] capitalize truncate min-w-0">
              {cat.name}
              {hasChildren && (
                <span className="ml-1.5 text-[10px] font-bold text-[var(--text-secondary)] opacity-30">
                  {cat.children.length}
                </span>
              )}
            </span>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {isEditing ? (
              <>
                <ActionBtn onClick={handleUpdate} title="Save" color="emerald">
                  <Check className="size-3.5" />
                </ActionBtn>
                <ActionBtn onClick={cancelEdit} title="Cancel" color="rose">
                  <X className="size-3.5" />
                </ActionBtn>
              </>
            ) : (
              <>
                <ActionBtn
                  onClick={() => openAdd(cat._id)}
                  title="Add subcategory"
                  color="accent"
                  className="opacity-0 group-hover:opacity-100"
                >
                  <Plus className="size-3.5" />
                </ActionBtn>
                <ActionBtn
                  onClick={() => startEdit(cat)}
                  title="Rename"
                  color="indigo"
                  className="opacity-0 group-hover:opacity-100"
                >
                  <Edit2 className="size-3.5" />
                </ActionBtn>
                <ActionBtn
                  onClick={() => handleDelete(cat._id)}
                  title="Delete"
                  color="rose"
                  className="opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </ActionBtn>
              </>
            )}
          </div>
        </div>

        {/* Inline add-sub form */}
        {isAddingHere && (
          <AddForm
            value={addName}
            onChange={setAddName}
            onSubmit={handleAdd}
            onCancel={closeAdd}
            depth={depth + 1}
            placeholder="Subcategory name"
          />
        )}

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>
            {cat.children.map(child => renderRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 md:top-16 lg:top-0 z-40 bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-[var(--glass-border)] px-4 sm:px-6 lg:px-10 h-16 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">Categories</h2>
          {!loading && (
            <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">
              {total} {total === 1 ? 'category' : 'categories'}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={fetchCategories}
          title="Refresh"
          className="size-9 rounded-xl border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-all active:scale-90"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <button
          type="button"
          onClick={() => openAdd(null)}
          className="flex items-center gap-1.5 h-9 px-4 bg-[var(--accent)] text-white rounded-xl text-[12px] font-bold shadow-sm shadow-[var(--accent)]/20 hover:brightness-110 active:scale-95 transition-all shrink-0"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Add Category</span>
          <span className="sm:hidden">Add</span>
        </button>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-6 lg:p-10 pb-32">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search categories…"
              className="w-full h-10 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 text-[13px] font-medium outline-none focus:border-[var(--accent)]/50 transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 size-5 rounded-full bg-[var(--text-secondary)]/10 flex items-center justify-center text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-500 transition-all"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Top-level add form */}
          {addParentId === null && (
            <AddForm
              value={addName}
              onChange={setAddName}
              onSubmit={handleAdd}
              onCancel={closeAdd}
              depth={0}
              placeholder="Category name (press Enter to save)"
            />
          )}

          {/* Category tree */}
          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 overflow-hidden shadow-sm">
            {loading ? (
              <div className="py-16 flex items-center justify-center gap-2 text-[var(--text-secondary)] opacity-30">
                <RefreshCw className="size-4 animate-spin" />
                <span className="text-[12px] font-semibold">Loading…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 flex flex-col items-center gap-3 opacity-30">
                <Folder className="size-10" />
                <p className="text-[11px] font-bold uppercase tracking-widest">
                  {query ? 'No matches found' : 'No categories yet'}
                </p>
              </div>
            ) : (
              <div>
                {filtered.map(cat => renderRow(cat))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Shared action button ──────────────────────────────────────────────────────
const COLOR_MAP = {
  emerald: 'hover:bg-emerald-500/10 hover:text-emerald-500',
  rose:    'hover:bg-rose-500/10 hover:text-rose-500',
  indigo:  'hover:bg-indigo-500/10 hover:text-indigo-500',
  accent:  'hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]',
};

function ActionBtn({ onClick, title, color, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`size-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] transition-all active:scale-90 ${COLOR_MAP[color] ?? ''} ${className}`}
    >
      {children}
    </button>
  );
}

// ── Inline add form ───────────────────────────────────────────────────────────
function AddForm({ value, onChange, onSubmit, onCancel, depth, placeholder }) {
  return (
    <div
      className="flex items-center gap-2 py-2 border-b border-[var(--accent)]/20 bg-[var(--accent)]/5 animate-in fade-in slide-in-from-top-1 duration-150"
      style={{ paddingLeft: `${depth * 20 + 12}px`, paddingRight: '12px' }}
    >
      {/* Spacer to align with chevron */}
      <div className="size-6 shrink-0" />
      <div className="size-7 rounded-lg flex items-center justify-center shrink-0 text-[var(--accent)] bg-[var(--accent)]/10">
        <Folder className="size-4" />
      </div>
      <input
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onCancel(); }}
        placeholder={placeholder}
        className="flex-1 h-8 bg-[var(--bg-primary)] border border-[var(--accent)]/40 rounded-lg px-3 text-[12px] font-semibold outline-none focus:border-[var(--accent)] transition-all capitalize placeholder:opacity-30 min-w-0"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!value.trim()}
        className="size-7 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center hover:brightness-110 active:scale-90 transition-all disabled:opacity-30 shrink-0"
      >
        <Check className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="size-7 rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-rose-500 hover:border-rose-500/20 flex items-center justify-center transition-all active:scale-90 shrink-0"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
