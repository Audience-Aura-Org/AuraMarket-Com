"use client";
import React, { useState, useEffect, useRef } from 'react';
import api from '@/services/api';
import { uploadService } from '@/services/upload';
import { 
  X, Save, Plus, Trash2, Image, List, 
  Settings, Clock, Upload, Search, 
  Check, ChevronDown, Package, ExternalLink, Store
} from 'lucide-react';

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

  useEffect(() => {
    if (section) {
      // Ensure all data items have the expected keys to follow controlled component pattern
      const sanitizedData = (section.data || []).map(item => ({
        headline: item.headline || '',
        subtext: item.subtext || '',
        image_url: item.image_url || '',
        link_to: item.link_to || '',
        cta_text: item.cta_text || '',
        product_id: item.product_id ? (typeof item.product_id === 'object' ? item.product_id._id : item.product_id) : '',
        category_name: item.category_name || '',
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
      alert('Upload failed');
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
      alert(`Error saving section: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const addDataItem = () => {
    setFormData(prev => ({
      ...prev,
      data: [...prev.data, { headline: '', subtext: '', image_url: '', link_to: '', cta_text: '', product_id: '', category_name: '', vendor_id: '' }]
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-12">
      <div className="absolute inset-0 bg-[#0a050a]/90 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl max-h-full bg-[var(--bg-primary)] rounded-[3rem] border border-[var(--glass-border)] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Product Lookup Overlay */}
        {showProductLookup && (
          <div className="absolute inset-0 z-[60] bg-[var(--bg-secondary)]/95 backdrop-blur-md p-10 flex flex-col items-center">
            <button onClick={() => setShowProductLookup(false)} className="absolute top-8 right-8 p-4 hover:bg-white/10 rounded-full transition-all">
              <X className="w-8 h-8" />
            </button>
            <div className="w-full max-w-2xl space-y-6 mt-10">
              <div className="text-center space-y-2">
                <h3 className="text-3xl font-quicksand font-bold text-[var(--text-primary)]">Product Lookup</h3>
                <p className="text-[var(--text-secondary)] font-medium">Search for products to copy their unique IDs.</p>
              </div>
              <div className="flex gap-4">
                <input 
                  autoFocus
                  placeholder="Search by name, brand, or category..."
                  className="flex-1 bg-[var(--bg-primary)] border border-[var(--glass-border)] px-6 py-4 rounded-2xl font-quicksand font-bold focus:border-[var(--accent)] outline-none"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchProducts()}
                />
                <button 
                  onClick={searchProducts}
                  className="bg-[var(--accent)] text-white px-8 rounded-2xl font-quicksand font-bold flex items-center gap-2"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[50vh] overflow-y-auto space-y-3 no-scrollbar pr-2">
                {productSearchResults.map(product => (
                  <div key={product._id} className="glass-panel p-4 rounded-2xl border border-[var(--glass-border)] flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                        <img src={product.images?.[0] || '/placeholder.png'} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className="font-quicksand font-bold text-[var(--text-primary)]">{product.name}</h4>
                        <div className="flex items-center gap-3 mt-0.5">
                           <span className="text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded border border-[var(--accent)]/20">{product.brand}</span>
                           <span className="text-[10px] lg:text-[12px] opacity-40 font-mono">{product._id}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(product._id);
                        alert('Product ID Copied!');
                        setShowProductLookup(false);
                      }}
                      className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight hover:bg-[var(--accent)] hover:text-white transition-all flex items-center gap-2"
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
        <div className="p-8 border-b border-[var(--glass-border)] flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-quicksand font-bold text-[var(--text-primary)]">
              {isEdit ? 'Edit Section' : 'Create Section'}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] font-medium tracking-tight">
              Configuring storefront layout block
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              type="button"
              onClick={() => setShowProductLookup(true)}
              className="bg-[var(--accent)]/10 text-[var(--accent)] px-4 py-2.5 rounded-xl font-quicksand font-bold flex items-center gap-2 text-[10px] lg:text-[12px] tracking-tight border border-[var(--accent)]/30 hover:bg-[var(--accent)]/20 transition-all"
            >
              <Package className="w-4 h-4" /> Product ID Lookup
            </button>
            <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-full transition-colors">
              <X className="w-8 h-8 opacity-40 hover:opacity-100" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-12 no-scrollbar">
          {/* Basic Config */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-quicksand font-bold tracking-tight opacity-40 ml-1">Section Type</label>
              <div className="relative">
                <select 
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value, data: [] }))}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-6 py-4 rounded-2xl font-quicksand font-bold text-white focus:border-[var(--accent)] outline-none appearance-none cursor-pointer"
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
              <label className="text-xs font-quicksand font-bold tracking-tight opacity-40 ml-1">Display Title</label>
              <input 
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Best Sellers"
                className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-6 py-4 rounded-2xl font-quicksand font-bold text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
              />
            </div>
          </div>

          {/* Section Specific Data Items */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-quicksand font-bold text-[var(--text-primary)] flex items-center gap-3">
                <List className="w-6 h-6 text-[var(--accent)]" /> 
                Section Content Items
              </h3>
              <button 
                type="button"
                onClick={addDataItem}
                className="text-xs font-quicksand font-bold tracking-tight text-[var(--accent)] flex items-center gap-2 hover:opacity-80"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>

            <div className="grid gap-6">
              {formData.data.map((item, i) => (
                <div key={i} className="glass-panel p-6 rounded-3xl border border-[var(--glass-border)] relative group/item">
                  <button 
                    type="button"
                    onClick={() => removeDataItem(i)}
                    className="absolute -top-3 -right-3 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity shadow-lg z-20"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>

                  <div className="grid md:grid-cols-2 gap-6">
                    {(['hero', 'promo_banner', 'categories'].includes(formData.type)) && (
                      <div className="space-y-2 md:col-span-2">
                         <label className="text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight opacity-40">Image URL / Upload</label>
                         <div className="flex gap-2">
                           <input 
                             value={item.image_url}
                             onChange={(e) => updateDataItem(i, 'image_url', e.target.value)}
                             className="flex-1 bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-sm"
                             placeholder="Cloudinary or external URL"
                           />
                           <label className="cursor-pointer bg-[var(--accent)]/10 text-[var(--accent)] p-3 rounded-xl border border-[var(--accent)]/20 hover:bg-[var(--accent)]/20 transition-all flex items-center justify-center min-w-[50px]">
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
                      </div>
                    )}

                    {(['hero', 'promo_banner'].includes(formData.type)) && (
                      <>
                        <div className="space-y-2">
                          <label className="text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight opacity-40">Headline</label>
                          <input 
                            value={item.headline}
                            onChange={(e) => updateDataItem(i, 'headline', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight opacity-40">Subtext</label>
                          <input 
                            value={item.subtext}
                            onChange={(e) => updateDataItem(i, 'subtext', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-sm"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight opacity-40">CTA Button Text (Optional)</label>
                          <input 
                            value={item.cta_text}
                            onChange={(e) => updateDataItem(i, 'cta_text', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-sm"
                            placeholder="e.g. Shop Now, Explore, Get Started"
                          />
                        </div>
                      </>
                    )}

                    {(['featured_products', 'collection', 'trending'].includes(formData.type)) && (
                      <div className="space-y-2 md:col-span-2">
                         <label className="text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight opacity-40">Search & Select Product</label>
                         <div className="relative" ref={activeProductDropdown === i ? dropdownRef : null}>
                            <div className="relative">
                               <input 
                                 value={activeProductDropdown === i ? productSearch : (typeof item.product_id === 'object' ? item.product_id?.name : (item.product_name || item.product_id || ''))}
                                 onChange={(e) => {
                                   setActiveProductDropdown(i);
                                   handleItemProductSearch(e.target.value);
                                 }}
                                 onFocus={() => {
                                   setActiveProductDropdown(i);
                                   setProductSearch('');
                                   setItemProductResults([]);
                                 }}
                                 className="w-full bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-sm pr-10"
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
                                            <p className="text-sm font-quicksand font-bold text-white truncate">{p.name}</p>
                                            <p className="text-[10px] lg:text-[12px] text-white/40 font-mono truncate">{p._id}</p>
                                         </div>
                                       </div>
                                     ))}
                                  </div>
                               </div>
                            )}
                         </div>
                         {item.product_id && typeof item.product_id !== 'object' && (
                           <div className="px-4 py-1.5 bg-[var(--accent)]/5 rounded-lg border border-[var(--accent)]/10 inline-flex items-center gap-2">
                             <Package className="w-3 h-3 text-[var(--accent)]" />
                             <span className="text-[11px] lg:text-[12px] font-quicksand font-bold  text-[var(--accent)]">ID: {item.product_id}</span>
                           </div>
                         )}
                      </div>
                    )}

                    {(['categories'].includes(formData.type)) && (
                      <div className="space-y-2">
                         <label className="text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight opacity-40">Category Selection</label>
                         <div className="relative" ref={activeCategoryDropdown === i ? dropdownRef : null}>
                            <div 
                              onClick={() => {
                                setActiveCategoryDropdown(activeCategoryDropdown === i ? null : i);
                                setCategorySearch('');
                              }}
                              className="w-full bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-sm flex items-center justify-between cursor-pointer hover:border-white/20 transition-all"
                            >
                              <span className={item.category_name ? 'text-white' : 'opacity-40'}>
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
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:border-[var(--accent)] text-white font-quicksand font-bold"
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
                                         <span className="text-xs font-quicksand font-bold">{cat.name}</span>
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
                        <label className="text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight opacity-40">Link Destination</label>
                        <div className="relative" ref={activeLinkDropdown === i ? dropdownRef : null}>
                           <div className="flex gap-2">
                              <input 
                                value={item.link_to}
                                onChange={(e) => updateDataItem(i, 'link_to', e.target.value)}
                                className="flex-1 bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-sm"
                                placeholder="/categories/tech"
                              />
                              <button 
                                type="button"
                                onClick={() => {
                                  setActiveLinkDropdown(activeLinkDropdown === i ? null : i);
                                  setCategorySearch('');
                                }}
                                className="bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-all text-[var(--accent)]"
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
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:border-[var(--accent)] text-white font-quicksand font-bold"
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
                                       className="flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-white/10 text-xs text-[var(--accent)] font-quicksand font-bold tracking-tight transition-all"
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
                                         <span className="text-xs font-quicksand font-bold">{cat.name}</span>
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
                         <label className="text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight opacity-40">Search & Select Vendor</label>
                         <div className="relative" ref={activeVendorDropdown === i ? dropdownRef : null}>
                            <div className="relative">
                               <input 
                                 value={activeVendorDropdown === i ? vendorSearch : (typeof item.vendor_id === 'object' ? item.vendor_id?.store_name : (item.vendor_name || item.vendor_id || ''))}
                                 onChange={(e) => {
                                   setActiveVendorDropdown(i);
                                   handleItemVendorSearch(e.target.value);
                                 }}
                                 onFocus={() => {
                                   setActiveVendorDropdown(i);
                                   setVendorSearch('');
                                   setItemVendorResults([]);
                                 }}
                                 className="w-full bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-sm pr-10"
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
                                            <p className="text-sm font-quicksand font-bold text-white truncate">{v.store_name}</p>
                                            <p className="text-[10px] lg:text-[12px] text-white/40 font-mono truncate">{v._id}</p>
                                         </div>
                                       </div>
                                     ))}
                                  </div>
                               </div>
                            )}
                         </div>
                         {item.vendor_id && typeof item.vendor_id !== 'object' && (
                           <div className="px-4 py-1.5 bg-[var(--accent)]/5 rounded-lg border border-[var(--accent)]/10 inline-flex items-center gap-2">
                             <Store className="w-3 h-3 text-[var(--accent)]" />
                             <span className="text-[11px] lg:text-[12px] font-quicksand font-bold  text-[var(--accent)]">ID: {item.vendor_id}</span>
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {formData.data.length === 0 && (
                <div className="p-12 border-2 border-dashed border-[var(--glass-border)] rounded-[3rem] text-center opacity-40">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-quicksand font-bold">No items added to this section yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Configuration & Scheduling */}
          <div className="grid md:grid-cols-2 gap-12 pt-8 border-t border-[var(--glass-border)] pb-10">
             <div className="space-y-6">
                <h4 className="font-quicksand font-bold flex items-center gap-2 tracking-tight  text-[10px] lg:text-[12px] text-[var(--accent)]">
                   <Settings className="w-4 h-4" /> Layout Config
                </h4>
                <div className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/5">
                   <span className="text-sm font-quicksand font-bold opacity-60 tracking-tight text-[10px] lg:text-[12px]">Layout Mode</span>
                   <select 
                     value={formData.config?.layout || 'grid'}
                     onChange={(e) => setFormData(prev => ({ ...prev, config: { ...prev.config, layout: e.target.value } }))}
                     className="bg-transparent font-quicksand font-bold text-sm outline-none cursor-pointer"
                   >
                     <option value="grid">Grid Layout</option>
                     <option value="carousel">Horizontal Carousel</option>
                   </select>
                </div>
                
                <div className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/5">
                   <div className="space-y-0.5">
                      <span className="text-sm font-quicksand font-bold opacity-60 tracking-tight text-[10px] lg:text-[12px]">Status</span>
                      <p className="text-[10px] lg:text-[12px] opacity-40 font-medium">Visible on Storefront</p>
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
                  <div className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/5">
                    <div className="space-y-0.5">
                       <span className="text-sm font-quicksand font-bold opacity-60 tracking-tight text-[10px] lg:text-[12px]">Autoplay</span>
                       <p className="text-[10px] lg:text-[12px] opacity-40 font-medium">Slide through banners</p>
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

             <div className="space-y-6">
                <h4 className="font-quicksand font-bold flex items-center gap-2 tracking-tight  text-[10px] lg:text-[12px] text-blue-400">
                   <Clock className="w-4 h-4" /> Scheduling
                </h4>
                <div className="grid gap-4">
                   <div className="space-y-2">
                      <label className="text-[11px] lg:text-[12px] font-quicksand font-bold  opacity-40 ml-1">Starts (Optional)</label>
                      <input 
                        type="datetime-local" 
                        value={formData.scheduled_start}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduled_start: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 px-5 py-4 rounded-2xl text-sm outline-none focus:border-blue-500/50 transition-all font-quicksand font-bold" 
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[11px] lg:text-[12px] font-quicksand font-bold  opacity-40 ml-1">Ends (Optional)</label>
                      <input 
                        type="datetime-local" 
                        value={formData.scheduled_end}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduled_end: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 px-5 py-4 rounded-2xl text-sm outline-none focus:border-blue-500/50 transition-all font-quicksand font-bold" 
                      />
                   </div>
                </div>
             </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-8 border-t border-[var(--glass-border)] flex items-center justify-end gap-4 bg-[var(--bg-secondary)] relative z-30">
          <button onClick={onClose} className="px-8 py-4 rounded-2xl font-quicksand font-bold opacity-60 hover:opacity-100 transition-all text-xs tracking-tight">
            Cancel
          </button>
          <button 
            disabled={loading}
            onClick={handleSubmit} 
            className="bg-[var(--accent)] text-white px-12 py-4 rounded-2xl font-quicksand font-bold shadow-2xl shadow-[var(--accent)]/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 text-xs  tracking-[0.2em]"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
            {isEdit ? 'Update Section' : 'Publish Section'}
          </button>
        </div>
      </div>
    </div>
  );
}
