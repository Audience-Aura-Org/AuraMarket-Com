"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '@/services/api';
import { uploadService } from '@/services/upload';
import {
  X, Save, Plus, Trash2, Image, List, 
  Settings, Clock, Upload, Search, 
  Check, ChevronDown, Package, ExternalLink, Store
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SectionForm({ section, onClose, onSuccess }) {
  const isEdit = !!section;
  const [formData, setFormData] = useState({
    type: 'hero',
    title: '',
    subtitle: '',
    order: 0,
    is_active: true,
    config: {
      layout: 'grid',
      autoplay: false
    },
    data: [],
    scheduled_start: '',
    scheduled_end: ''
  });

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [activeCategoryDropdown, setActiveCategoryDropdown] = useState(null);
  const [activeLinkDropdown, setActiveLinkDropdown] = useState(null);
  const [activeProductDropdown, setActiveProductDropdown] = useState(null);
  const dropdownRef = useRef(null);

  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [itemProductResults, setItemProductResults] = useState([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [showProductLookup, setShowProductLookup] = useState(false);

  const [uploadingIndex, setUploadingIndex] = useState(null);
  
  // Vendor Search State
  const [vendorSearch, setVendorSearch] = useState('');
  const [activeVendorDropdown, setActiveVendorDropdown] = useState(null);
  const [itemVendorResults, setItemVendorResults] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (section) {
      // Ensure all data items have the expected keys to follow controlled component pattern
      const sanitizedData = (section.data || []).map(item => ({
        headline: item.headline || '',
        subtext: item.subtext || '',
        image_url: item.image_url || '',
        link_to: item.link_to || '',
        cta_text: item.cta_text || '',
        product_name: item.product_name || (typeof item.product_id === 'object' ? item.product_id?.name || '' : ''),
        product_id: item.product_id ? (typeof item.product_id === 'object' ? item.product_id._id : item.product_id) : '',
        category_name: item.category_name || '',
        vendor_name: item.vendor_name || (typeof item.vendor_id === 'object' ? item.vendor_id?.store_name || '' : ''),
        vendor_id: item.vendor_id ? (typeof item.vendor_id === 'object' ? item.vendor_id._id : item.vendor_id) : ''
      }));

      setFormData({
        ...section,
        config: section.config || { layout: 'grid', autoplay: false },
        data: sanitizedData,
        scheduled_start: section.scheduled_start ? new Date(section.scheduled_start).toISOString().slice(0, 16) : '',
        scheduled_end: section.scheduled_end ? new Date(section.scheduled_end).toISOString().slice(0, 16) : '',
      });
    }

    const fetchCategories = async () => {
      try {
        const res = await api.get('/categories');
        if (res.data?.success) setCategories(res.data.data);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();

    // Close dropdowns on outside click
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveCategoryDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [section]);

  const searchProducts = async () => {
    if (!productSearchQuery.trim()) return;
    setIsSearchingProducts(true);
    try {
      const res = await api.get(`/products?search=${productSearchQuery}`);
      if (res.data?.success) {
        setProductSearchResults(res.data.data.products || []);
      }
    } catch (err) {
      console.error('Product search failed');
    } finally {
      setIsSearchingProducts(false);
    }
  };

  const handleItemProductSearch = async (query) => {
    setProductSearch(query);
    if (query.length < 2) {
      setItemProductResults([]);
      return;
    }
    try {
      const res = await api.get(`/products?search=${query}`);
      if (res.data?.success) {
        setItemProductResults(res.data.data.products || []);
      }
    } catch (err) {
      console.error('Item product search failed');
    }
  };

  const handleItemVendorSearch = async (query) => {
    setVendorSearch(query);
    if (query.length < 2) {
      setItemVendorResults([]);
      return;
    }
    try {
      const res = await api.get(`/vendors?search=${query}`);
      if (res.data?.success) {
        setItemVendorResults(res.data.data.stores || []); // Controller returns { stores }
      }
    } catch (err) {
      console.error('Item vendor search failed');
    }
  };

  const [productSearch, setProductSearch] = useState('');

  const handleFileUpload = async (index, file) => {
    if (!file) return;
    setUploadingIndex(index);
    try {
      const uploadType = formData.type === 'categories' ? 'categories' : 'banners';
      const res = await uploadService.uploadSingle(file, uploadType);
      if (res.success) {
        updateDataItem(index, 'image_url', res.data.url);
      }
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Sanitize the data to prevent CastErrors for ObjectIds and Dates
      const { _id, __v, createdAt, updatedAt, ...cleanData } = formData;
      const sanitizedPayload = {
        ...cleanData,
        scheduled_start: cleanData.scheduled_start === '' ? null : cleanData.scheduled_start,
        scheduled_end: cleanData.scheduled_end === '' ? null : cleanData.scheduled_end,
        data: cleanData.data.map(item => {
          const { _id: item_id, ...itemClean } = item;
          const cleaned = { ...itemClean };
          
          // Ensure we only send the ID string if it's an object
          if (cleaned.product_id && typeof cleaned.product_id === 'object') {
            cleaned.product_id = cleaned.product_id._id;
          }
          if (cleaned.vendor_id && typeof cleaned.vendor_id === 'object') {
            cleaned.vendor_id = cleaned.vendor_id._id;
          }

          if (!cleaned.product_id || (typeof cleaned.product_id === 'string' && cleaned.product_id.trim() === '')) delete cleaned.product_id;
          if (!cleaned.vendor_id || (typeof cleaned.vendor_id === 'string' && cleaned.vendor_id.trim() === '')) delete cleaned.vendor_id;
          return cleaned;
        })
      };

      if (isEdit) {
        await api.patch(`/homepage/admin/sections/${section._id}`, sanitizedPayload);
      } else {
        await api.post('/homepage/admin/sections', sanitizedPayload);
      }
      
      onSuccess();
    } catch (err) {
      console.error('Save Error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Check your data fields and try again.';
      toast.error(`Error saving section: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const addDataItem = () => {
    setFormData(prev => ({
      ...prev,
      data: [...prev.data, { headline: '', subtext: '', image_url: '', link_to: '', cta_text: '', product_name: '', product_id: '', category_name: '', vendor_name: '', vendor_id: '' }]
    }));
  };

  const removeDataItem = (index) => {
    setFormData(prev => ({
      ...prev,
      data: prev.data.filter((_, i) => i !== index)
    }));
  };

  const updateDataItem = (index, field, value) => {
    const newData = [...formData.data];
    newData[index][field] = value;
    setFormData(prev => ({ ...prev, data: newData }));
  };

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const editorOverlay = (
    <div className="fixed inset-0 z-[9999] flex items-stretch justify-stretch p-0">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative flex h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-[var(--bg-primary)] shadow-2xl animate-in fade-in duration-200">
        {/* Product Lookup Overlay */}
        {showProductLookup && (
          <div className="absolute inset-0 z-[60] flex flex-col bg-[var(--bg-secondary)]/95 p-4 backdrop-blur-md sm:p-6">
            <button onClick={() => setShowProductLookup(false)} className="absolute right-4 top-4 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-2 transition-all hover:text-[var(--accent)]">
              <X className="size-5" />
            </button>
            <div className="mx-auto mt-10 w-full max-w-4xl space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">Product Lookup</h3>
                <p className="text-xs font-medium text-[var(--text-secondary)]">Search products and copy their unique IDs.</p>
              </div>
              <div className="flex gap-2">
                <input 
                  autoFocus
                  placeholder="Search by name, brand, or category..."
                  className="h-12 flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 !text-base font-semibold outline-none placeholder:!text-base focus:border-[var(--accent)]"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchProducts()}
                />
                <button 
                  onClick={searchProducts}
                  className="flex h-12 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 font-semibold text-white"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[calc(100dvh-210px)] space-y-3 overflow-y-auto pr-1 no-scrollbar">
                {productSearchResults.map(product => (
                  <div key={product._id} className="glass-panel p-4 rounded-2xl border border-[var(--glass-border)] flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                        <img src={product.images?.[0]?.url || product.images?.[0] || '/placeholder.png'} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className=" font-bold text-[var(--text-primary)]">{product.name}</h4>
                        <div className="flex items-center gap-3 mt-0.5">
                           <span className="text-[11px] lg:text-[12px]  font-semibold tracking-tight bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded border border-[var(--accent)]/20">{product.brand}</span>
                           <span className="text-[10px] lg:text-[12px] opacity-40 font-mono">{product._id}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(product._id);
                        toast.success('Product ID copied');
                        setShowProductLookup(false);
                      }}
                      className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-[11px] lg:text-[12px]  font-semibold tracking-tight hover:bg-[var(--accent)] hover:text-white transition-all flex items-center gap-2"
                    >
                      <Package className="w-3.5 h-3.5" /> Select ID
                    </button>
                  </div>
                ))}
                {!isSearchingProducts && productSearchResults.length === 0 && productSearchQuery && (
                  <div className="text-center py-10 opacity-40">No products found for "{productSearchQuery}"</div>
                )}
                {isSearchingProducts && (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3 sm:px-6">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-lg font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
              {isEdit ? 'Edit Section' : 'Create Section'}
            </h2>
            <p className="text-[11px] font-medium text-[var(--text-secondary)] sm:text-xs">
              Configure the storefront block and its content.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button 
              type="button"
              onClick={() => setShowProductLookup(true)}
              className="hidden items-center gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 py-2 text-[11px] font-semibold text-[var(--accent)] transition-all hover:bg-[var(--accent)]/20 sm:flex"
            >
              <Package className="size-4" /> Product Lookup
            </button>
            <button onClick={onClose} className="flex size-10 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] transition-colors hover:text-[var(--accent)]">
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto bg-[var(--bg-secondary)]/35 p-3 no-scrollbar sm:p-5 lg:p-6">
          {/* Basic Config */}
          <div className="grid gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm md:grid-cols-2 sm:p-5">
            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-semibold text-[var(--text-secondary)]">Section Type</label>
              <div className="relative">
                <select 
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value, data: [] }))}
                  className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 !text-base font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                >
                  <option value="hero" className="bg-[#120a12]">Hero Banner Carousel</option>
                  <option value="categories" className="bg-[#120a12]">Category Horizontal List</option>
                  <option value="featured_products" className="bg-[#120a12]">Featured Products Grid</option>
                  <option value="trending" className="bg-[#120a12]">Trending Products</option>
                  <option value="promo_banner" className="bg-[#120a12]">Promo Large Banner</option>
                  <option value="stores" className="bg-[#120a12]">Vendor Highlights</option>
                  <option value="collection" className="bg-[#120a12]">Product Collection</option>
                  <option value="recommendations" className="bg-[#120a12]">Personalization Block</option>
                </select>
                <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 opacity-20 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-semibold text-[var(--text-secondary)]">Display Title</label>
              <input 
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Best Sellers"
                className="h-12 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 !text-base font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Section Specific Data Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <List className="size-4 text-[var(--accent)]" />
                Content items
              </h3>
              <button 
                type="button"
                onClick={addDataItem}
                className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2 text-[11px] font-semibold text-white transition active:scale-[0.98]"
              >
                <Plus className="size-4" /> Add item
              </button>
            </div>

            <div className="grid gap-3">
              {formData.data.map((item, i) => (
                <div key={i} className="group/item relative rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm sm:p-5">
                  <button 
                    type="button"
                    onClick={() => removeDataItem(i)}
                    className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 transition hover:bg-rose-500 hover:text-white"
                  >
                    <Trash2 className="size-4" />
                  </button>

                  <div className="mb-4 flex items-center gap-2 pr-12">
                    <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">
                      Item {i + 1}
                    </span>
                    <span className="truncate text-[11px] font-medium text-[var(--text-secondary)]">
                      {item.headline || item.category_name || item.product_name || item.vendor_name || 'New content item'}
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {(['hero', 'promo_banner', 'categories'].includes(formData.type)) && (
                      <div className="space-y-2 md:col-span-2">
                         <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Image URL / Upload</label>
                         <div className="flex gap-2">
                           <input 
                             value={item.image_url}
                             onChange={(e) => updateDataItem(i, 'image_url', e.target.value)}
                             className="h-11 flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 !text-base outline-none focus:border-[var(--accent)]"
                             placeholder="Image URL"
                           />
                           <label className="flex min-w-[46px] cursor-pointer items-center justify-center rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 p-3 text-[var(--accent)] transition-all hover:bg-[var(--accent)]/20">
                              {uploadingIndex === i ? (
                                <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Upload className="w-5 h-5" />
                              )}
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => handleFileUpload(i, e.target.files[0])}
                              />
                           </label>
                         </div>
                         {item.image_url && (
                           <div className="flex items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-2">
                             <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-primary)]">
                               <img src={item.image_url} alt="Section image preview" className="size-full object-cover" />
                             </div>
                             <div className="min-w-0">
                               <p className="text-[11px] font-semibold text-[var(--text-primary)]">Image preview</p>
                               <p className="truncate text-[10px] font-medium text-[var(--text-secondary)]">{item.image_url}</p>
                             </div>
                           </div>
                         )}
                      </div>
                    )}

                    {(['hero', 'promo_banner'].includes(formData.type)) && (
                      <>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Headline</label>
                          <input 
                            value={item.headline}
                            onChange={(e) => updateDataItem(i, 'headline', e.target.value)}
                            className="h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 !text-base outline-none focus:border-[var(--accent)]"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Subtext</label>
                          <input 
                            value={item.subtext}
                            onChange={(e) => updateDataItem(i, 'subtext', e.target.value)}
                            className="h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 !text-base outline-none focus:border-[var(--accent)]"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[11px] font-semibold text-[var(--text-secondary)]">CTA Button Text (Optional)</label>
                          <input 
                            value={item.cta_text}
                            onChange={(e) => updateDataItem(i, 'cta_text', e.target.value)}
                            className="h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 !text-base outline-none focus:border-[var(--accent)]"
                            placeholder="e.g. Shop Now, Explore, Get Started"
                          />
                        </div>
                      </>
                    )}

                    {(['featured_products', 'collection', 'trending'].includes(formData.type)) && (
                      <div className="space-y-2 md:col-span-2">
                         <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Search & Select Product</label>
                         <div className="relative" ref={activeProductDropdown === i ? dropdownRef : null}>
                            <div className="relative">
                               <input 
                                 value={activeProductDropdown === i ? productSearch : (item.product_name || (typeof item.product_id === 'object' ? item.product_id?.name : ''))}
                                 onChange={(e) => {
                                   setActiveProductDropdown(i);
                                   handleItemProductSearch(e.target.value);
                                 }}
                                 onFocus={() => {
                                   setActiveProductDropdown(i);
                                   setProductSearch('');
                                   setItemProductResults([]);
                                 }}
                                 className="h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 pr-10 !text-base placeholder:!text-base outline-none focus:border-[var(--accent)]"
                                 placeholder="Search products by name..."
                               />
                               <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
                            </div>

                            {activeProductDropdown === i && itemProductResults.length > 0 && (
                               <div className="absolute top-full left-0 right-0 mt-2 bg-[#120a12] border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] p-2 space-y-1 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                                  <div className="max-h-60 overflow-y-auto no-scrollbar">
                                     {itemProductResults.map(p => (
                                       <div 
                                         key={p._id}
                                         onClick={() => {
                                           updateDataItem(i, 'product_id', p._id);
                                           // We store name helper for UI
                                           const newData = [...formData.data];
                                           newData[i].product_name = p.name;
                                           setFormData(prev => ({ ...prev, data: newData }));
                                           setActiveProductDropdown(null);
                                         }}
                                         className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors border border-transparent hover:border-white/10 group"
                                       >
                                         <div className="w-10 h-10 rounded-lg bg-white/5 flex-shrink-0 border border-white/10 overflow-hidden">
                                            <img src={p.images?.[0]?.url || p.images?.[0]} className="w-full h-full object-cover rounded-lg group-hover:scale-110 transition-transform" />
                                         </div>
                                         <div className="min-w-0">
                                            <p className="text-sm  font-bold text-white truncate">{p.name}</p>
                                            <p className="text-[10px] lg:text-[12px] text-white/40 font-mono truncate">{p._id}</p>
                                         </div>
                                       </div>
                                     ))}
                                  </div>
                               </div>
                            )}
                         </div>
                         {item.product_id && (
                           <div className="px-4 py-1.5 bg-[var(--accent)]/5 rounded-lg border border-[var(--accent)]/10 inline-flex items-center gap-2">
                             <Package className="w-3 h-3 text-[var(--accent)]" />
                             <span className="text-[11px] lg:text-[12px]  font-semibold  text-[var(--accent)]">
                               Selected product: {item.product_name || (typeof item.product_id === 'object' ? item.product_id?.name : '') || 'Product selected'}
                             </span>
                           </div>
                         )}
                      </div>
                    )}

                    {(['categories'].includes(formData.type)) && (
                      <div className="space-y-2">
                         <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Category Selection</label>
                         <div className="relative" ref={activeCategoryDropdown === i ? dropdownRef : null}>
                            <div 
                              onClick={() => {
                                setActiveCategoryDropdown(activeCategoryDropdown === i ? null : i);
                                setCategorySearch('');
                              }}
                              className="flex h-11 w-full cursor-pointer items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 !text-base transition-all hover:border-[var(--accent)]/40"
                            >
                              <span className={item.category_name ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}>
                                {item.category_name || 'Select Category'}
                              </span>
                              <ChevronDown className="w-4 h-4 opacity-40" />
                            </div>

                            {activeCategoryDropdown === i && (
                               <div className="absolute top-full left-0 right-0 mt-2 bg-[#120a12] border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] p-2 space-y-2 animate-in fade-in slide-in-from-top-2">
                                  <div className="relative">
                                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
                                      <input 
                                        autoFocus
                                        placeholder="Filter categories..."
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 !text-base placeholder:!text-base outline-none focus:border-[var(--accent)] text-white font-bold"
                                        value={categorySearch}
                                        onChange={(e) => setCategorySearch(e.target.value)}
                                      />
                                  </div>
                                  <div className="max-h-48 overflow-y-auto no-scrollbar">
                                     {filteredCategories.map(cat => (
                                       <div 
                                         key={cat._id}
                                         onClick={() => {
                                           updateDataItem(i, 'category_name', cat.name);
                                           setActiveCategoryDropdown(null);
                                         }}
                                         className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all border border-transparent ${item.category_name === cat.name ? 'bg-[var(--accent)] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                                       >
                                         <span className="text-xs  font-bold">{cat.name}</span>
                                         {item.category_name === cat.name && <Check className="w-4 h-4" />}
                                       </div>
                                     ))}
                                     {filteredCategories.length === 0 && (
                                       <div className="text-[10px] lg:text-[12px] text-center py-4 opacity-40 tracking-tight">No matches</div>
                                     )}
                                  </div>
                               </div>
                            )}
                         </div>
                      </div>
                    )}

                     <div className="space-y-2">
                        <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Link Destination</label>
                        <div className="relative" ref={activeLinkDropdown === i ? dropdownRef : null}>
                           <div className="flex gap-2">
                              <input 
                                value={item.link_to}
                                onChange={(e) => updateDataItem(i, 'link_to', e.target.value)}
                                className="h-11 flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 !text-base outline-none focus:border-[var(--accent)]"
                                placeholder="/categories/tech"
                              />
                              <button 
                                type="button"
                                onClick={() => {
                                  setActiveLinkDropdown(activeLinkDropdown === i ? null : i);
                                  setCategorySearch('');
                                }}
                                className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-3 text-[var(--accent)] transition-all hover:bg-[var(--accent)]/10"
                                title="Pick from Categories"
                              >
                                <List className="w-5 h-5" />
                              </button>
                           </div>

                           {activeLinkDropdown === i && (
                               <div className="absolute top-full left-0 right-0 mt-2 bg-[#120a12] border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] p-2 space-y-2 animate-in fade-in slide-in-from-top-2">
                                  <div className="relative">
                                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 text-white" />
                                      <input 
                                        autoFocus
                                        placeholder="Search category to link..."
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 !text-base placeholder:!text-base outline-none focus:border-[var(--accent)] text-white font-bold"
                                        value={categorySearch}
                                        onChange={(e) => setCategorySearch(e.target.value)}
                                      />
                                  </div>
                                  <div className="max-h-48 overflow-y-auto no-scrollbar">
                                     <div 
                                       onClick={() => {
                                         updateDataItem(i, 'link_to', '/shop');
                                         setActiveLinkDropdown(null);
                                       }}
                                       className="flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-white/10 text-xs text-[var(--accent)]  font-bold tracking-tight transition-all"
                                     >
                                        [ Generic Shop Page ]
                                     </div>
                                     {filteredCategories.map(cat => (
                                       <div 
                                         key={cat._id}
                                         onClick={() => {
                                           updateDataItem(i, 'link_to', `/shop?category=${encodeURIComponent(cat.name)}`);
                                           setActiveLinkDropdown(null);
                                         }}
                                         className="flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer hover:bg-white/10 text-white/70 hover:text-white transition-all border border-transparent"
                                       >
                                         <span className="text-xs  font-bold">{cat.name}</span>
                                         <ExternalLink className="w-3.5 h-3.5 opacity-20" />
                                       </div>
                                     ))}
                                  </div>
                               </div>
                            )}
                        </div>
                     </div>

                    {(formData.type === 'stores') && (
                      <div className="space-y-2 md:col-span-2">
                         <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Search & Select Vendor</label>
                         <div className="relative" ref={activeVendorDropdown === i ? dropdownRef : null}>
                            <div className="relative">
                               <input 
                                 value={activeVendorDropdown === i ? vendorSearch : (item.vendor_name || (typeof item.vendor_id === 'object' ? item.vendor_id?.store_name : ''))}
                                 onChange={(e) => {
                                   setActiveVendorDropdown(i);
                                   handleItemVendorSearch(e.target.value);
                                 }}
                                 onFocus={() => {
                                   setActiveVendorDropdown(i);
                                   setVendorSearch('');
                                   setItemVendorResults([]);
                                 }}
                                 className="h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 pr-10 !text-base placeholder:!text-base outline-none focus:border-[var(--accent)]"
                                 placeholder="Search vendors by store name..."
                               />
                               <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
                            </div>

                            {activeVendorDropdown === i && itemVendorResults.length > 0 && (
                               <div className="absolute top-full left-0 right-0 mt-2 bg-[#120a12] border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] p-2 space-y-1 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                                  <div className="max-h-60 overflow-y-auto no-scrollbar">
                                     {itemVendorResults.map(v => (
                                       <div 
                                         key={v._id}
                                         onClick={() => {
                                           updateDataItem(i, 'vendor_id', v._id);
                                           const newData = [...formData.data];
                                           newData[i].vendor_name = v.store_name;
                                           setFormData(prev => ({ ...prev, data: newData }));
                                           setActiveVendorDropdown(null);
                                         }}
                                         className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors border border-transparent hover:border-white/10 group"
                                       >
                                         <div className="w-10 h-10 rounded-lg bg-white/5 flex-shrink-0 border border-white/10 overflow-hidden">
                                            <img src={v.store?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${v.store_name}&backgroundColor=var(--accent)`} className="w-full h-full object-cover rounded-lg group-hover:scale-110 transition-transform" />
                                         </div>
                                         <div className="min-w-0">
                                            <p className="text-sm  font-bold text-white truncate">{v.store_name}</p>
                                            <p className="text-[10px] lg:text-[12px] text-white/40 font-mono truncate">{v._id}</p>
                                         </div>
                                       </div>
                                     ))}
                                  </div>
                               </div>
                            )}
                         </div>
                         {item.vendor_id && (
                           <div className="px-4 py-1.5 bg-[var(--accent)]/5 rounded-lg border border-[var(--accent)]/10 inline-flex items-center gap-2">
                             <Store className="w-3 h-3 text-[var(--accent)]" />
                             <span className="text-[11px] lg:text-[12px]  font-semibold  text-[var(--accent)]">
                               Selected vendor: {item.vendor_name || (typeof item.vendor_id === 'object' ? item.vendor_id?.store_name : '') || 'Vendor selected'}
                             </span>
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {formData.data.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-primary)] p-10 text-center">
                  <Package className="mx-auto mb-3 size-9 text-[var(--text-secondary)] opacity-40" />
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">No items added to this section yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Configuration & Scheduling */}
          <div className="grid gap-3 border-t border-[var(--glass-border)] pt-4 pb-4 md:grid-cols-2">
             <div className="space-y-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm">
                <h4 className="flex items-center gap-2 text-[11px] font-semibold text-[var(--accent)]">
                   <Settings className="size-4" /> Layout Config
                </h4>
                <div className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-4">
                   <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Layout Mode</span>
                   <select 
                     value={formData.config?.layout || 'grid'}
                     onChange={(e) => setFormData(prev => ({ ...prev, config: { ...prev.config, layout: e.target.value } }))}
                     className="cursor-pointer bg-transparent text-sm font-semibold outline-none"
                   >
                     <option value="grid">Grid Layout</option>
                     <option value="carousel">Horizontal Carousel</option>
                   </select>
                </div>
                
                <div className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-4">
                   <div className="space-y-0.5">
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Status</span>
                      <p className="text-[10px] font-medium text-[var(--text-secondary)]">Visible on storefront</p>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={!!formData.is_active}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      />
                      <div className="w-12 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 shadow-inner" />
                   </label>
                </div>

                {formData.type === 'hero' && (
                  <div className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-4">
                    <div className="space-y-0.5">
                       <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Autoplay</span>
                       <p className="text-[10px] font-medium text-[var(--text-secondary)]">Slide through banners</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={!!formData.config?.autoplay}
                          onChange={(e) => setFormData(prev => ({ ...prev, config: { ...prev.config, autoplay: e.target.checked } }))}
                        />
                        <div className="w-12 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent)] shadow-inner" />
                    </label>
                  </div>
                )}
             </div>

             <div className="space-y-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm">
                <h4 className="flex items-center gap-2 text-[11px] font-semibold text-blue-500">
                   <Clock className="size-4" /> Scheduling
                </h4>
                <div className="grid gap-4">
                   <div className="space-y-2">
                      <label className="ml-1 text-[11px] font-semibold text-[var(--text-secondary)]">Starts (Optional)</label>
                      <input 
                        type="datetime-local" 
                        value={formData.scheduled_start}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduled_start: e.target.value }))}
                        className="h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 text-sm font-semibold outline-none transition-all focus:border-blue-500/50" 
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="ml-1 text-[11px] font-semibold text-[var(--text-secondary)]">Ends (Optional)</label>
                      <input 
                        type="datetime-local" 
                        value={formData.scheduled_end}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduled_end: e.target.value }))}
                        className="h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 text-sm font-semibold outline-none transition-all focus:border-blue-500/50" 
                      />
                   </div>
                </div>
             </div>
          </div>
        </form>

        {/* Footer */}
        <div className="relative z-30 flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--glass-border)] bg-[var(--bg-primary)] p-3 sm:flex-row sm:items-center sm:justify-end sm:p-4">
          <button onClick={onClose} className="h-11 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-5 text-[12px] font-semibold text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)]">
            Cancel
          </button>
          <button 
            disabled={loading}
            onClick={handleSubmit} 
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 text-[12px] font-semibold text-white shadow-lg shadow-[var(--accent)]/20 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
            {isEdit ? 'Update Section' : 'Publish Section'}
          </button>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(editorOverlay, document.body) : null;
}
