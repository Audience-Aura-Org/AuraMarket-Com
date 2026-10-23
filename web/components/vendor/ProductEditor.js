'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, ChevronLeft, ChevronRight, ImagePlus, Layers3, Loader2, Package, Plus, Save, Tag, Truck, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import CategoryPicker from '@/components/CategoryPicker';
import { MAX_PRODUCT_IMAGES, prepareProductImageEntries } from '@/lib/productImageUpload';
import { emptyProductForm, generateProductVariants, productFormData, productImageUrl, validateProduct } from '@/lib/productEditor';
import { ProductPageHeader, ProductSection, useProductPaths } from './ProductWorkspace';
import styles from './Products.module.css';

function Field({ name, label, errors, hint, children }) {
  return <div>
    <label htmlFor={`product-${name}`} className={styles.fieldLabel}>{label}</label>
    {children}
    {errors[name] ? <p id={`error-${name}`} className={styles.error}>{errors[name]}</p>
      : hint && <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-secondary)]">{hint}</p>}
  </div>;
}

const initialAttributes = () => [{ name: 'Color', options: [], metadata: {} }];

function saveError(err) {
  const payload = err?.response?.data;
  if (err?.response?.status === 402 || payload?.code === 'SUBSCRIPTION_REQUIRED') return 'Activate a vendor package before publishing products.';
  if (payload?.code === 'PRODUCT_LIMIT_REACHED') return payload.message || 'Your package has reached its product limit. Upgrade to add more products.';
  return payload?.message || (err?.response ? 'Could not save this product. Please try again.' : 'Could not reach the server. Check your connection and try again.');
}

export default function ProductEditor({ productId, editing = false }) {
  const router = useRouter();
  const paths = useProductPaths();
  const userId = useAuthStore((state) => state.user?._id);
  const [form, setForm] = useState(emptyProductForm);
  const [images, setImages] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [hasVariants, setHasVariants] = useState(false);
  const [variantTypes, setVariantTypes] = useState(initialAttributes);
  const [skuVariants, setSkuVariants] = useState([]);
  const [optionInputs, setOptionInputs] = useState({});
  const [parcelClass, setParcelClass] = useState('small');
  const [fetching, setFetching] = useState(editing);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [ready, setReady] = useState(false);
  const [createdProduct, setCreatedProduct] = useState(null);
  const [postingStory, setPostingStory] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const fileRef = useRef(null);
  const savingRef = useRef(false);
  const preparingRef = useRef(false);
  const storyRef = useRef(false);
  const dirtyRef = useRef(false);
  const errorRef = useRef(null);
  const dialogRef = useRef(null);
  const draftKey = userId ? `aura_add_product_draft:${userId}` : null;

  const loadProduct = useCallback(async (signal) => {
    setFetching(true);
    setLoadError('');
    try {
      if (!productId || productId === '__placeholder__') throw new Error('Open a product from your catalogue to edit it.');
      const res = await api.get(`/products/${encodeURIComponent(productId)}`, { skipClientCache: true, signal });
      const product = res.data?.data?.product;
      if (!res.data?.success || !product) throw new Error('This product could not be found.');
      if (signal?.aborted) return;
      setForm(Object.fromEntries(Object.entries(emptyProductForm()).map(([key]) => [key, product[key] ?? ''])));
      setImages((product.images || []).map((image) => ({ url: productImageUrl(image), existing: true })).filter((image) => image.url));
      setTags(Array.isArray(product.tags) ? product.tags : []);
      setHasVariants(Boolean(product.has_variants));
      setVariantTypes(Array.isArray(product.variant_types) && product.variant_types.length ? product.variant_types : initialAttributes());
      setSkuVariants(Array.isArray(product.sku_variants) ? product.sku_variants : []);
      setParcelClass(product.parcel_class === 'oversize' ? 'oversize' : 'small');
      dirtyRef.current = false;
      setReady(true);
    } catch (err) {
      if (!signal?.aborted) setLoadError(err?.response?.data?.message || err.message || 'Could not load this product.');
    } finally {
      if (!signal?.aborted) setFetching(false);
    }
  }, [productId]);

  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();
    loadProduct(controller.signal);
    return () => controller.abort();
  }, [editing, loadProduct]);

  useEffect(() => {
    if (editing || !draftKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
      if (saved) {
        setForm({ ...emptyProductForm(), ...saved.form });
        setTags(Array.isArray(saved.tags) ? saved.tags : []);
        setHasVariants(Boolean(saved.hasVariants));
        setVariantTypes(saved.variantTypes?.length ? saved.variantTypes : initialAttributes());
        setSkuVariants(Array.isArray(saved.skuVariants) ? saved.skuVariants : []);
        setParcelClass(saved.parcelClass === 'oversize' ? 'oversize' : 'small');
        setDraftSaved(true);
      }
    } catch { /* A corrupt or unavailable local draft must not block the form. */ }
    setReady(true);
  }, [draftKey, editing]);

  useEffect(() => {
    if (editing || !ready || !draftKey || createdProduct || !dirtyRef.current) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ form, tags, hasVariants, variantTypes, skuVariants, parcelClass }));
      setDraftSaved(true);
    } catch { setDraftSaved(false); }
  }, [editing, ready, draftKey, createdProduct, form, tags, hasVariants, variantTypes, skuVariants, parcelClass]);

  useEffect(() => {
    const warn = (event) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(() => {
    if (!createdProduct) return;
    const dialog = dialogRef.current;
    const focusables = () => [...dialog.querySelectorAll('button:not(:disabled), a[href]')];
    focusables()[0]?.focus();
    const trapFocus = (event) => {
      if (event.key !== 'Tab') return;
      const elements = focusables();
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog.addEventListener('keydown', trapFocus);
    return () => dialog.removeEventListener('keydown', trapFocus);
  }, [createdProduct]);

  const changeField = (key, value) => {
    dirtyRef.current = true;
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };
  const inputProps = (key) => ({
    id: `product-${key}`, name: key, value: form[key],
    onChange: (event) => changeField(key, event.target.value),
    className: `${styles.input} text-[12px]`,
    'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `error-${key}` : undefined,
  });

  const addImages = async (files) => {
    if (preparingRef.current || savingRef.current) return;
    const candidates = Array.from(files || []);
    if (!candidates.length) return;
    if (candidates.some((file) => !file.type.startsWith('image/'))) return toast.error('Choose image files only.');
    const room = MAX_PRODUCT_IMAGES - images.length;
    if (room <= 0) return toast.error(`You can add up to ${MAX_PRODUCT_IMAGES} images.`);
    if (candidates.length > room) toast.error(`Only the first ${room} images will be added.`);
    preparingRef.current = true;
    setPreparing(true);
    try {
      const prepared = await prepareProductImageEntries(candidates.slice(0, room));
      setImages((previous) => [...previous, ...prepared].slice(0, MAX_PRODUCT_IMAGES));
      dirtyRef.current = true;
      setErrors((previous) => ({ ...previous, images: undefined }));
    } catch (err) { toast.error(err.message || 'Could not prepare images. Try another file.'); }
    finally { preparingRef.current = false; setPreparing(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const updateAttributes = (next, previousVariants = skuVariants) => {
    try {
      // Keep entered prices while an attribute name is temporarily blank.
      const variants = next.some((type) => !type.name.trim() && type.options.length)
        ? previousVariants : generateProductVariants(next, previousVariants, form);
      dirtyRef.current = true;
      setVariantTypes(next);
      setSkuVariants(variants);
      setErrors((previous) => ({ ...previous, variants: undefined }));
    } catch (err) { toast.error(err.message); }
  };
  const renameAttribute = (index, name) => {
    const otherNames = variantTypes.filter((_, i) => i !== index).map((type) => type.name.trim());
    const oldName = variantTypes[index].name.trim() || Object.keys(skuVariants[0]?.combination || {}).find((key) => !otherNames.includes(key));
    const previous = name.trim() && oldName ? skuVariants.map((variant) => {
      const combination = { ...variant.combination };
      if (oldName in combination) { const option = combination[oldName]; delete combination[oldName]; combination[name.trim()] = option; }
      return { ...variant, combination };
    }) : skuVariants;
    updateAttributes(variantTypes.map((type, i) => i === index ? { ...type, name } : type), previous);
  };
  const addOption = (index) => {
    const value = (optionInputs[index] || '').trim();
    if (!value) return;
    if (variantTypes[index].options.some((option) => option.toLowerCase() === value.toLowerCase())) return toast.error('That option already exists.');
    updateAttributes(variantTypes.map((type, i) => i === index ? { ...type, options: [...type.options, value] } : type));
    setOptionInputs((previous) => ({ ...previous, [index]: '' }));
  };
  const addTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    if (!tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) setTags((previous) => [...previous, value]);
    setTagInput(''); dirtyRef.current = true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (savingRef.current || preparingRef.current || createdProduct || !ready) return;
    const nextErrors = validateProduct({ form, images, hasVariants, variantTypes, skuVariants });
    setErrors(nextErrors);
    setSubmitError('');
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const data = productFormData({ form, images, tags, parcelClass, hasVariants, variantTypes, skuVariants });
      const res = editing ? await api.patch(`/products/${encodeURIComponent(productId)}`, data) : await api.post('/products', data);
      if (!res.data?.success) throw new Error(res.data?.message || 'The product was not saved. Please try again.');
      dirtyRef.current = false;
      if (draftKey) { try { sessionStorage.removeItem(draftKey); } catch {} }
      toast.success(editing ? 'Product updated successfully.' : 'Product published successfully.');
      if (editing) router.push(paths.list);
      else setCreatedProduct(res.data.data?.product || res.data.data || { name: form.name });
    } catch (err) {
      setSubmitError(err.response ? saveError(err) : err.message === 'Network Error' ? saveError(err) : err.message || saveError(err));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { savingRef.current = false; setSaving(false); }
  };

  const leaveEditor = () => {
    if (dirtyRef.current && !window.confirm(editing ? 'Leave without saving your changes?' : 'Leave this product? Text details are kept as a draft; selected images will need to be added again.')) return;
    dirtyRef.current = false;
    router.push(paths.list);
  };

  const postStory = async () => {
    if (storyRef.current) return;
    const image = productImageUrl(createdProduct?.images?.[0]);
    if (!createdProduct?._id || !image) return toast.error('Open Stories to share this product after its images are available.');
    storyRef.current = true; setPostingStory(true);
    try {
      const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 3);
      const res = await api.post('/statuses', { type: 'image', content_url: image, thumbnail_url: image, linked_product: createdProduct._id, caption: `New arrival: ${createdProduct.name}`, category: 'New Arrivals', expiry_days: 3, expires_at: expiresAt.toISOString() });
      if (!res.data?.success) throw new Error(res.data?.message || 'Could not post your story.');
      toast.success('Story posted.'); router.push(paths.list);
    } catch (err) { toast.error(err.response?.data?.message || err.message || 'Could not post your story.'); }
    finally { storyRef.current = false; setPostingStory(false); }
  };

  const title = editing ? 'Edit product' : 'Add product';
  const submitLabel = saving ? (editing ? 'Saving...' : 'Publishing...') : editing ? 'Save changes' : 'Publish product';
  const busy = saving || preparing;
  const totalStock = hasVariants ? skuVariants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0) : Number(form.stock) || 0;
  const displayPrice = hasVariants && skuVariants.length ? Math.min(...skuVariants.map((variant) => Number(variant.sale_price || variant.price) || 0)) : Number(form.sale_price || form.price) || 0;

  if (loadError) return <div className={styles.page}>
    <ProductPageHeader title={title} description="Manage your product listing" back={paths.list} />
    <div className="mx-auto max-w-xl px-4 py-12"><ProductSection icon={AlertCircle} title="Could not open this product" description={loadError}>
      <div className="flex gap-3"><button type="button" className={styles.secondaryButton} onClick={() => loadProduct()}>Try again</button><Link className={styles.button} href={paths.list}>Back to products</Link></div>
    </ProductSection></div>
  </div>;

  return <div className={styles.page}>
    <ProductPageHeader title={title} description={editing ? 'Update the details customers see in your store.' : 'Bring something new to your store.'} onBack={leaveEditor} backDisabled={busy}>
      <button type="submit" form="product-editor" className={styles.button} disabled={busy || fetching || !ready || Boolean(createdProduct)}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}<span className="text-[11px]">{submitLabel}</span>
      </button>
    </ProductPageHeader>
    {fetching ? <div className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-8" aria-label="Loading product" aria-busy="true"><div className="h-32 animate-pulse rounded-[2rem] bg-[var(--bg-primary)]" /><div className="h-96 animate-pulse rounded-[2rem] bg-[var(--bg-primary)]" /></div> :
      <form id="product-editor" noValidate onSubmit={handleSubmit} className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 pb-32 sm:px-6 md:px-8 md:py-7">
        {(submitError || Object.values(errors).some(Boolean)) && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-[12px] text-rose-600 dark:text-rose-300">
          <p className="flex items-center gap-2 font-semibold"><AlertCircle className="size-4 shrink-0" />{submitError || 'Check the highlighted fields before continuing.'}</p>
          {!submitError && <ul className="mt-2 list-disc space-y-1 pl-6">{Object.entries(errors).filter(([, message]) => message).map(([key, message]) => <li key={key}><a href={`#product-${key}`}>{message}</a></li>)}</ul>}
        </div>}
        <fieldset disabled={busy || Boolean(createdProduct)} className="grid min-w-0 gap-5 border-0 p-0 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
          <div className="min-w-0 space-y-5">
            <ProductSection icon={Package} title="Product details" description="A clear name and description help customers choose with confidence.">
              <div className="space-y-5">
                <Field name="name" label="Product name *" errors={errors}><input {...inputProps('name')} maxLength={150} placeholder="e.g. Classic canvas tote" autoComplete="off" /></Field>
                <Field name="description" label="Short description *" errors={errors} hint={`${form.description.length}/2,000 characters`}><textarea {...inputProps('description')} rows={4} maxLength={2000} placeholder="What makes this product special? Include its key features." /></Field>
                <Field name="long_description" label="More details" errors={errors} hint="Optional. Add care instructions, materials, or anything else customers should know."><textarea {...inputProps('long_description')} rows={4} placeholder="Tell customers a little more..." /></Field>
                <Field name="specifications" label="Specifications" errors={errors}><textarea {...inputProps('specifications')} rows={3} placeholder="Dimensions, materials, weight..." /></Field>
              </div>
            </ProductSection>
            <ProductSection icon={ImagePlus} title="Product images" description="Add up to five photos. Your first image is the cover." id="product-images">
              {images.length > 0 && <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-5">{images.map((image, index) => <div key={`${image.url}-${index}`} className="relative min-w-0">
                <img src={image.url} alt={`Product image ${index + 1}`} className="aspect-square w-full rounded-2xl border border-[var(--glass-border)] object-cover" />
                <button type="button" aria-label={`Remove image ${index + 1}`} onClick={() => { setImages((previous) => previous.filter((_, i) => i !== index)); dirtyRef.current = true; }} className="absolute right-1 top-1 rounded-full bg-black/70 p-1.5 text-white"><X className="size-3" /></button>
                {index === 0 && <span className="absolute bottom-1 left-1 rounded-full bg-[var(--bg-primary)] px-2 py-0.5 text-[9px] font-medium">Cover</span>}
                <div className="mt-1 flex justify-center gap-2">
                  <button type="button" aria-label={`Move image ${index + 1} earlier`} disabled={index === 0 || images[index - 1]?.existing !== image.existing} onClick={() => { setImages((previous) => { const next = [...previous]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; }); dirtyRef.current = true; }} className="rounded-lg p-1 disabled:opacity-25"><ChevronLeft className="size-3.5" /></button>
                  <button type="button" aria-label={`Move image ${index + 1} later`} disabled={index === images.length - 1 || images[index + 1]?.existing !== image.existing} onClick={() => { setImages((previous) => { const next = [...previous]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; }); dirtyRef.current = true; }} className="rounded-lg p-1 disabled:opacity-25"><ChevronRight className="size-3.5" /></button>
                </div>
              </div>)}</div>}
              <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" aria-label="Upload product images" onChange={(event) => addImages(event.target.files)} />
              {images.length < MAX_PRODUCT_IMAGES && <button type="button" className={styles.dropzone} onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addImages(event.dataTransfer.files); }}>
                {preparing ? <Loader2 className="size-6 animate-spin text-[var(--accent)]" /> : <ImagePlus className="size-6 text-[var(--accent)]" />}
                <span className="text-[12px] font-semibold">{preparing ? 'Preparing images...' : 'Choose images or drop them here'}</span><span className="text-[10px] text-[var(--text-secondary)]">Up to 5 MB per image after optimization · {images.length}/{MAX_PRODUCT_IMAGES} added</span>
              </button>}
              {errors.images && <p className={styles.error}>{errors.images}</p>}
            </ProductSection>
            <ProductSection icon={Layers3} title="Pricing & inventory" description="Set one price or offer options such as size and color.">
              <div className="mb-5 flex gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-1.5">
                {[{ value: false, label: 'Simple product' }, { value: true, label: 'With variants' }].map((option) => <button key={option.label} type="button" aria-pressed={hasVariants === option.value} className={`flex-1 rounded-xl px-3 py-3 text-[11px] font-semibold transition ${hasVariants === option.value ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]'}`} onClick={() => { setHasVariants(option.value); dirtyRef.current = true; }}>{option.label}</button>)}
              </div>
              {!hasVariants ? <div className="grid gap-4 sm:grid-cols-3">
                <Field name="price" label="Price (XAF) *" errors={errors}><input {...inputProps('price')} type="number" min="1" step="1" inputMode="numeric" placeholder="0" /></Field>
                <Field name="sale_price" label="Sale price (XAF)" errors={errors} hint="Optional. Lower than the regular price."><input {...inputProps('sale_price')} type="number" min="1" step="1" inputMode="numeric" placeholder="Optional" /></Field>
                <Field name="stock" label="Stock quantity *" errors={errors}><input {...inputProps('stock')} type="number" min="0" step="1" inputMode="numeric" placeholder="0" /></Field>
              </div> : <div id="product-variants" className="space-y-4">
                {variantTypes.map((type, index) => <div key={index} className="space-y-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 p-4">
                  <div className="flex items-center gap-2"><label className="min-w-0 flex-1"><span className={styles.fieldLabel}>Attribute {index + 1}</span><input className={`${styles.input} text-[12px]`} key={type.name} defaultValue={type.name} aria-label={`Attribute ${index + 1} name`} placeholder="e.g. Size or Color" onBlur={(event) => renameAttribute(index, event.target.value)} /></label><button type="button" className={`${styles.iconButton} mt-6`} aria-label={`Remove attribute ${index + 1}`} onClick={() => { updateAttributes(variantTypes.filter((_, i) => i !== index)); setOptionInputs({}); }}><X className="size-4" /></button></div>
                  <div className="flex flex-wrap gap-2">{type.options.map((option) => <span key={option} className={`${styles.pill} bg-[var(--bg-primary)] text-[var(--accent)]`}>{option}
                    {type.name.trim().toLowerCase() === 'color' && <input type="color" aria-label={`Color swatch for ${option}`} value={type.metadata?.[option] || '#000000'} onChange={(event) => { setVariantTypes((previous) => previous.map((attribute, i) => i === index ? { ...attribute, metadata: { ...attribute.metadata, [option]: event.target.value } } : attribute)); dirtyRef.current = true; }} className="size-5 rounded border-0 bg-transparent p-0" />}
                    <button type="button" aria-label={`Remove ${option} option`} onClick={() => updateAttributes(variantTypes.map((attribute, i) => i === index ? { ...attribute, options: attribute.options.filter((value) => value !== option) } : attribute))}><X className="size-3" /></button></span>)}</div>
                  <div className="flex gap-2"><input className={`${styles.input} text-[12px]`} value={optionInputs[index] || ''} aria-label={`New option for attribute ${index + 1}`} placeholder="Add an option, e.g. Medium" onChange={(event) => setOptionInputs((previous) => ({ ...previous, [index]: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addOption(index); } }} /><button type="button" aria-label={`Add option to attribute ${index + 1}`} className={styles.iconButton} onClick={() => addOption(index)}><Plus className="size-4" /></button></div>
                </div>)}
                <button type="button" className={styles.secondaryButton} onClick={() => { setVariantTypes((previous) => [...previous, { name: '', options: [], metadata: {} }]); dirtyRef.current = true; }}><Plus className="size-4" />Add attribute</button>
                {skuVariants.length > 0 && <div><p className="mb-3 text-[11px] font-medium text-[var(--text-secondary)]">{skuVariants.length} variant{skuVariants.length !== 1 ? 's' : ''} · Set a price and stock for each combination.</p>
                  {skuVariants.map((variant, index) => { const label = Object.values(variant.combination).join(' / '); return <div key={JSON.stringify(variant.combination)} className={styles.variantRow}>
                    <p className="break-words text-[12px] font-medium">{label}</p>
                    {[['price', 'Price (XAF)'], ['sale_price', 'Sale (XAF)'], ['stock', 'Stock']].map(([key, fieldLabel]) => <label key={key}><span className="mb-1 block text-[10px] text-[var(--text-secondary)]">{fieldLabel}</span><input type="number" min={key === 'stock' ? 0 : 1} step="1" inputMode="numeric" aria-label={`${label} ${fieldLabel}`} value={variant[key] ?? ''} placeholder={key === 'sale_price' ? 'Optional' : '0'} className={`${styles.input} text-[12px]`} onChange={(event) => { setSkuVariants((previous) => previous.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item)); dirtyRef.current = true; }} /></label>)}
                  </div>; })}
                </div>}
                {errors.variants && <p className={styles.error}>{errors.variants}</p>}
              </div>}
            </ProductSection>
          </div>
          <div className="min-w-0 space-y-5">
            <ProductSection icon={Tag} title="Organization" description="Make your product easy to discover.">
              <div className="space-y-5">
                <div id="product-category"><p className={styles.fieldLabel}>Category *</p>{form.category && <p className="mb-2 text-[11px] font-medium text-[var(--accent)]">Selected: {form.category}</p>}<CategoryPicker value={form.category} onChange={(value) => changeField('category', value)} appliesTo="retail" />{errors.category && <p className={styles.error}>{errors.category}</p>}</div>
                <div><label htmlFor="product-tags" className={styles.fieldLabel}>Tags</label><div className="mb-3 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className={`${styles.pill} text-[var(--accent)]`}>{tag}<button type="button" aria-label={`Remove tag ${tag}`} onClick={() => { setTags((previous) => previous.filter((value) => value !== tag)); dirtyRef.current = true; }}><X className="size-3" /></button></span>)}</div>
                  <div className="flex gap-2"><input id="product-tags" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} className={`${styles.input} text-[12px]`} placeholder="e.g. Handmade" /><button type="button" className={styles.iconButton} onClick={addTag} aria-label="Add tag"><Plus className="size-4" /></button></div>
                </div>
              </div>
            </ProductSection>
            <ProductSection icon={Truck} title="Shipping size" description="Choose the size that best fits this product.">
              <div className="space-y-2">{[{ value: 'small', title: 'Standard parcel', detail: 'Fits a 40 × 30 × 20 cm box. Eligible for intercity delivery.' }, { value: 'oversize', title: 'Large or bulky', detail: 'Too large for a standard parcel. Local delivery only.' }].map((option) => <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${parcelClass === option.value ? 'border-[var(--accent)]/35 bg-[var(--accent)]/5' : 'border-[var(--glass-border)]'}`}>
                <input type="radio" name="parcel_class" value={option.value} checked={parcelClass === option.value} onChange={() => { setParcelClass(option.value); dirtyRef.current = true; }} className="mt-1 accent-[var(--accent)]" /><span><span className="block text-[12px] font-medium">{option.title}</span><span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-secondary)]">{option.detail}</span></span>
              </label>)}</div>
            </ProductSection>
            <ProductSection icon={Package} title="Listing preview" description="A quick look before you publish.">
              {images[0] ? <img src={images[0].url} alt="Listing cover preview" className="mb-4 aspect-[4/3] w-full rounded-2xl object-cover" /> : <div className="mb-4 flex aspect-[4/3] items-center justify-center rounded-2xl bg-[var(--bg-secondary)]"><Package className="size-10 text-[var(--text-secondary)] opacity-30" /></div>}
              <p className="text-[10px] text-[var(--text-secondary)]">{form.category || 'Your category'}</p><p className="mt-1 break-words text-sm font-semibold">{form.name || 'Your product name'}</p><p className="mt-3 text-lg font-bold tabular-nums">{hasVariants ? 'From ' : ''}{displayPrice.toLocaleString()} <span className="text-[11px] font-medium text-[var(--text-secondary)]">XAF</span></p><p className="mt-1 text-[11px] text-[var(--text-secondary)]">{totalStock} in stock{hasVariants ? ` · ${skuVariants.length} variants` : ''}</p>
            </ProductSection>
            {!editing && draftSaved && <p className="flex items-start gap-2 px-2 text-[10px] leading-relaxed text-[var(--text-secondary)]"><Save className="mt-0.5 size-3.5 shrink-0" />Text details are saved as a draft on this device. Add images again if you leave this page.</p>}
          </div>
        </fieldset>
        <div className={styles.submitBar}><button type="button" className={styles.secondaryButton} onClick={leaveEditor} disabled={saving}>Cancel</button><button type="submit" className={styles.button} disabled={busy || !ready || Boolean(createdProduct)}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{submitLabel}</button></div>
      </form>}
    {createdProduct && <div ref={dialogRef} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="published-title">
      <div className={`${styles.panel} w-full max-w-sm !bg-[var(--bg-primary)] text-center`}>
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500"><Check className="size-7" /></span><h2 id="published-title" className="text-lg font-bold">Your product is published</h2><p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">Share it as a story so your followers can discover it.</p>
        <div className="mt-6 flex flex-col gap-3"><button type="button" autoFocus disabled={postingStory} onClick={postStory} className={styles.button}>{postingStory ? 'Posting story...' : 'Share as a story'}</button><Link href={paths.list} className={styles.secondaryButton}>Back to products</Link></div>
      </div>
    </div>}
  </div>;
}
