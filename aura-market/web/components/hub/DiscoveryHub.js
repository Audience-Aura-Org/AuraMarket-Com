"use client";

import { useState, useEffect } from 'react';
import { 
  MessageCircle, Compass, ShoppingBag, Package, User,
  Search, Send, MoreVertical, Phone, Video, Image,
  Heart, Share2, MessageSquare, ShoppingCart, Plus,
  ArrowLeft, Check, CheckCheck, MoreHorizontal, Mic, Paperclip,
  Star, MapPin, Filter, X, HeartIcon, ChevronRight, Home, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import cartStore from '@/services/cartStore';
import socketService from '@/services/socket';
import Link from 'next/link';
import Pagination from '@/components/common/Pagination';

const TABS = [
  { id: 'chats', icon: MessageCircle, label: 'Chats' },
  { id: 'discover', icon: Compass, label: 'Discover' },
  { id: 'shop', icon: ShoppingBag, label: 'Shop' },
  { id: 'orders', icon: Package, label: 'Orders' },
  { id: 'wishlist', icon: HeartIcon, label: 'Wishlist' },
];

// Normalize identifier to always target the USER ID for consistent deduplication
function getPartnerUserId(partner) {
  if (!partner) return null;
  if (typeof partner === 'string') return partner;
  const uid = partner.user_id?._id || partner.user_id || partner._id || partner.id;
  return uid ? uid.toString() : null;
}

// Support consistent name resolution: Store Name > Name
function getDisplayName(partner) {
  if (!partner) return 'Unknown';
  return partner.store_name || partner.name || partner.user_id?.name || 'Aura User';
}
export default function DiscoveryHub() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('discover');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex flex-col">
      {/* Top Tab Navigation - Pinned */}
      <div className="sticky top-0 z-50 bg-[var(--bg-primary)] border-b border-[var(--glass-border)] px-2 py-2">
        <div className="flex items-center justify-around">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all relative ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeTab" 
                    className="absolute inset-0 bg-[var(--accent)]/10 rounded-xl" 
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <div className="relative z-10">
                  <Icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''} transition-transform`} />
                  {tab.id === 'chats' && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--bg-primary)]" />}
                </div>
                <span className={`text-[8px] font-black mt-1 ${isActive ? 'text-[var(--accent)]' : 'opacity-50 uppercase tracking-widest'}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === 'discover' && <DiscoveryContent key="discover" user={user} />}
          {activeTab === 'chats' && <ChatsContent key="chats" user={user} />}
          {activeTab === 'shop' && <ShopContent key="shop" user={user} />}
          {activeTab === 'orders' && <OrdersContent key="orders" user={user} />}
          {activeTab === 'wishlist' && <WishlistContent key="wishlist" user={user} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ===================== DISCOVER TAB =====================
function DiscoveryContent({ user }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryTree, setCategoryTree] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeCategoryName, setActiveCategoryName] = useState('All');
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Current level categories
  const currentLevel = breadcrumb.length === 0
    ? categoryTree
    : breadcrumb[breadcrumb.length - 1].children;

  // Fetch categories
  useEffect(() => {
    setIsCategoriesLoading(true);
    api.get('/categories/with-products')
      .then(res => { if (res.data.success) setCategoryTree(res.data.data); })
      .catch(err => console.error(err))
      .finally(() => setIsCategoriesLoading(false));
  }, []);

  // Fetch products
  useEffect(() => {
    fetchProducts();
  }, [activeCategoryName, search]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = { limit: 20 };
      if (activeCategoryName && activeCategoryName !== 'All') params.category = activeCategoryName;
      if (search) params.search = search;
      
      const res = await api.get('/products/hub', { params });
      if (res.data.success) {
        const allProducts = [...(res.data.data.followedProducts || []), ...(res.data.data.products || [])];
        setProducts(allProducts.filter((p, i, arr) => arr.findIndex(x => x._id === p._id) === i));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCategoryClick = (cat) => {
    if (cat.children && cat.children.length > 0) {
      setBreadcrumb(prev => [...prev, cat]);
    } else {
      setActiveCategoryId(cat._id);
      setActiveCategoryName(cat.name);
    }
  };

  const handleBreadcrumbClick = (idx) => {
    if (idx === -1) {
      setBreadcrumb([]);
      setActiveCategoryId(null);
      setActiveCategoryName('All');
    } else {
      const newBreadcrumb = breadcrumb.slice(0, idx + 1);
      setBreadcrumb(newBreadcrumb);
      const last = newBreadcrumb[newBreadcrumb.length - 1];
      setActiveCategoryId(last._id);
      setActiveCategoryName(last.name);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="h-full overflow-y-auto flex flex-col"
    >
      {/* Search Bar */}
      <div className="sticky top-0 z-40 bg-[var(--bg-primary)] border-b border-[var(--glass-border)]/50 px-4 py-2">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-full py-2 pl-4 pr-12 text-[10px] focus:ring-1 focus:ring-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-secondary)]/50 font-medium"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" />
        </div>
      </div>

      {/* Category Navigation */}
      <div className="sticky top-12 z-40 bg-[var(--bg-primary)] border-b border-[var(--glass-border)] py-2.5 px-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {isCategoriesLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="shrink-0 w-20 h-8 rounded-full bg-[var(--bg-secondary)] animate-pulse border border-[var(--glass-border)]/30"></div>
            ))
          ) : (
            <>
              {breadcrumb.length > 0 ? (
                <button 
                  onClick={() => handleBreadcrumbClick(-1)} 
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  <Home className="size-3" /> Home
                </button>
              ) : (
                <button 
                  onClick={() => { setActiveCategoryId(null); setActiveCategoryName('All'); }}
                  className={`shrink-0 px-3 py-1.5 rounded-full border transition-all text-[10px] font-medium shadow-sm ${
                    activeCategoryName === 'All' 
                      ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]' 
                      : 'border-[var(--glass-border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  All
                </button>
              )}

              {breadcrumb.length > 0 && breadcrumb.map((crumb, idx) => (
                <div key={crumb._id} className="flex items-center gap-2 shrink-0">
                  <ChevronRight className="size-3 text-[var(--glass-border)] hidden sm:block" />
                  <button 
                    onClick={() => handleBreadcrumbClick(idx)} 
                    className={`px-3 py-1.5 rounded-full border transition-all text-[10px] font-medium shadow-sm ${
                      idx === breadcrumb.length - 1 && currentLevel.length === 0 
                        ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]' 
                        : 'border-[var(--glass-border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}

              {breadcrumb.length > 0 && currentLevel.length > 0 && <div className="h-4 w-px bg-[var(--glass-border)] mx-1 shrink-0 hidden sm:block" />}

              {currentLevel.map(cat => (
                <button
                  key={cat._id}
                  onClick={() => handleCategoryClick(cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-full border transition-all text-[9px] font-bold shadow-sm ${
                    activeCategoryId === cat._id 
                      ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]' 
                      : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-[var(--bg-primary)] animate-pulse border border-[var(--glass-border)]" />
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
            {products.map((product) => (
              <ProductCard 
                key={product._id} 
                product={product} 
                onClick={() => setSelectedProduct(product)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <ShoppingBag className="w-12 h-12 text-[var(--text-secondary)]/30 mb-3" />
            <p className="text-[var(--text-secondary)] font-semibold">No products found</p>
            <p className="text-[10px] text-[var(--text-secondary)] opacity-60 mt-1">Try a different category or search term</p>
          </div>
        )}
      </div>

      {/* Quick Buy Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <QuickBuyModal 
            product={selectedProduct} 
            onClose={() => setSelectedProduct(null)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProductCard({ product, onClick }) {
  const { user } = useAuthStore();
  const [imageError, setImageError] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addingToWishlist, setAddingToWishlist] = useState(false);

  const handleAddToCart = (e) => {
    e.stopPropagation();
    if (!user) {
      alert('Please login to add items to cart');
      return;
    }
    setAddingToCart(true);
    try {
      cartStore.addItem(product, 1);
      api.post('/cart', { product_id: product._id, quantity: 1 }).finally(() => setAddingToCart(false));
    } catch (err) {
      console.error(err);
      setAddingToCart(false);
    }
  };

  const handleAddToWishlist = async (e) => {
    e.stopPropagation();
    if (!user) {
      alert('Please login to add items to wishlist');
      return;
    }
    setAddingToWishlist(true);
    try {
      await api.post(`/wishlist/toggle/${product._id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to add to wishlist');
    } finally {
      setAddingToWishlist(false);
    }
  };
  
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative bg-[var(--bg-primary)] rounded-3xl border border-[var(--glass-border)] overflow-hidden shadow-lg group cursor-pointer"
    >
      {/* Product Image */}
      <div className="aspect-square relative overflow-hidden">
        {!imageError && product.images?.[0]?.url ? (
          <img 
            src={product.images[0].url} 
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-[var(--bg-secondary)] flex items-center justify-center">
            <ShoppingBag className="w-12 h-12 text-[var(--accent)]/30" />
          </div>
        )}
        
        {/* Quick Actions Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button 
            onClick={handleAddToWishlist}
            disabled={addingToWishlist}
            className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-red-500 shadow-xl hover:scale-110 transition-transform disabled:opacity-50"
          >
            <Heart className="w-6 h-6" />
          </button>
          <button 
            onClick={handleAddToCart}
            disabled={addingToCart}
            className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[var(--accent)] shadow-xl hover:scale-110 transition-transform disabled:opacity-50"
          >
            <ShoppingCart className="w-6 h-6" />
          </button>
        </div>

        {/* Discount Badge */}
        {product.discount > 0 && (
          <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full">
            -{product.discount}%
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3 space-y-2">
        <h3 className="text-xs font-semibold text-[var(--text-primary)] line-clamp-2 leading-tight">{product.name}</h3>
        
        <div className="flex items-center justify-between">
          <div>
            <span className="text-base font-black text-[var(--accent)]">{product.price?.toLocaleString()}</span>
            <span className="text-[10px] text-[var(--text-secondary)] ml-1">XAF</span>
          </div>
          {product.rating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">{product.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Seller Info */}
        <div className="flex items-center gap-2 pt-2 border-t border-[var(--glass-border)]">
          <div className="w-5 h-5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
            {product.vendor_id?.logo?.url ? (
              <img src={product.vendor_id.logo.url} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[8px] font-black text-[var(--accent)]">
                {product.vendor_id?.store_name?.[0] || 'V'}
              </div>
            )}
          </div>
          <span className="text-[9px] text-[var(--text-secondary)] font-medium truncate">{product.vendor_id?.store_name || 'Vendor'}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 border-t border-[var(--glass-border)]">
          <button
            onClick={handleAddToWishlist}
            disabled={addingToWishlist}
            className="flex-1 py-2 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center gap-1 text-[10px] font-bold hover:bg-red-500/20 hover:text-red-500 transition-all disabled:opacity-50"
          >
            <Heart className="w-4 h-4" />
            Wishlist
          </button>
          <button
            onClick={handleAddToCart}
            disabled={addingToCart}
            className="flex-1 py-2 rounded-xl bg-[var(--accent)]/20 flex items-center justify-center gap-1 text-[10px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/30 transition-all disabled:opacity-50"
          >
            <ShoppingCart className="w-4 h-4" />
            Add Cart
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function QuickBuyModal({ product, onClose }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);

  const handleBuy = async () => {
    if (!user) {
      alert('Please login to make a purchase');
      router.push('/login');
      return;
    }

    setBuying(true);
    try {
      // Add item to cart locally
      cartStore.addItem(product, quantity);
      
      // Sync cart to backend
      cartStore.startMutation();
      try {
        await api.post('/cart', {
          product_id: product._id,
          quantity: quantity
        });
      } finally {
        cartStore.endMutation();
      }

      // Redirect to checkout
      router.push('/checkout');
      onClose();
    } catch (err) {
      console.error('Cart error:', err);
      alert('Failed to add to cart. Please try again.');
    } finally {
      setBuying(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: '100%' }} 
        animate={{ y: 0 }} 
        exit={{ y: '100%' }}
        className="w-full md:max-w-md bg-[var(--bg-primary)] rounded-t-3xl md:rounded-3xl border-t md:border border-[var(--glass-border)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
          <h3 className="text-lg font-black text-[var(--text-primary)] uppercase">Quick Buy</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
            <X className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Product Preview */}
        <div className="flex gap-4 p-4">
          <div className="w-24 h-24 rounded-2xl bg-[var(--bg-secondary)] overflow-hidden flex-shrink-0">
            {product.images?.[0]?.url ? (
              <img src={product.images[0].url} className="w-full h-full object-cover" alt={product.name} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="w-8 h-8 text-[var(--accent)]/30" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-[var(--text-primary)] line-clamp-2">{product.name}</h4>
            <p className="text-xl font-black text-[var(--accent)] mt-2">{product.price?.toLocaleString()} XAF</p>
            {product.stock > 0 && (
              <p className="text-[10px] text-emerald-500 font-semibold mt-1">{product.stock} in stock</p>
            )}
          </div>
        </div>

        {/* Quantity Selector */}
        <div className="px-4 py-3 border-t border-[var(--glass-border)]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--text-secondary)]">Quantity</span>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-primary)] font-bold"
              >
                -
              </button>
              <span className="w-12 text-center text-lg font-black">{quantity}</span>
              <button 
                onClick={() => setQuantity(Math.min(product.stock || 10, quantity + 1))}
                className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-primary)] font-bold"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-[var(--glass-border)] space-y-3">
          <button 
            onClick={handleBuy}
            disabled={buying}
            className="w-full py-4 rounded-2xl bg-[var(--accent)] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-[var(--accent)]/30 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {buying ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShoppingCart className="w-5 h-5" />
                Buy Now - {(product.price * quantity).toLocaleString()} XAF
              </>
            )}
          </button>
          <button className="w-full py-4 rounded-2xl bg-[var(--bg-secondary)] text-[var(--text-primary)] font-black text-sm uppercase tracking-wider border border-[var(--glass-border)] flex items-center justify-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Chat with Seller
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===================== CHATS TAB =====================
function ChatsContent({ user }) {
  const [chats, setChats] = useState([]);
  const [followedVendors, setFollowedVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchChats();
    fetchFollowedVendors();
    setupSocketListeners();
  }, []);

  const fetchChats = async () => {
    try {
      const res = await api.get('/chat');
      if (res.data.success) {
        let chatList = res.data.data.activeChats || res.data.data || [];
        
        // Deduplicate by normalized USER ID - keep only one chat per partner
        const seen = new Set();
        const deduped = chatList.filter(chat => {
          const partnerUserId = getPartnerUserId(chat.partner);
          if (!partnerUserId || seen.has(partnerUserId)) return false;
          seen.add(partnerUserId);
          return true;
        });
        
        setChats(deduped);
      }
    } catch (err) { console.error(err); }
  };

  const fetchFollowedVendors = async () => {
    try {
      const res = await api.get('/users/followed-vendors');
      if (res.data.success) {
        const vendors = res.data.data?.follows || res.data.data?.vendors || res.data.data || [];
        setFollowedVendors(Array.isArray(vendors) ? vendors : []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const setupSocketListeners = () => {
    socketService.on('receive_message', (msg) => {
      const currentUserId = user?._id?.toString();
      const senderId = (msg.sender_id?._id || msg.sender_id)?.toString();
      if (senderId !== currentUserId) {
        setChats(prev => prev.map(chat => {
          const pid = getPartnerUserId(chat.partner);
          if (pid && pid === senderId) return { ...chat, snippet: msg.text, date: new Date().toISOString(), read_status: false };
          return chat;
        }));
      }
    });
  };

  const filteredChats = chats.filter(chat => {
    const name = chat.partner?.name || chat.partner?.store_name || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: 20 }}
      className="h-full flex flex-col"
    >
      {/* Search Bar */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)]/50 outline-none"
          />
        </div>
      </div>

      {/* Chat List - Shows active chats + followed vendors (like WhatsApp contacts) */}
      <div className="flex-1 overflow-y-auto">
        {/* Section Header: Active Chats */}
        {chats.length > 0 && (
          <div className="px-4 py-2 bg-[var(--bg-secondary)]/50">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">Active Conversations</p>
          </div>
        )}
        
        {chats.map((chat, i) => (
          <ChatItem key={getPartnerUserId(chat.partner) || `chat-${i}`} chat={chat} />
        ))}

        {/* Section Header: Followed Vendors (WhatsApp-style contacts) */}
        {followedVendors.length > 0 && (
          <>
            <div className="px-4 py-2 bg-[var(--bg-secondary)]/50 mt-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">Following ({followedVendors.length})</p>
            </div>
            {followedVendors.map((vendor, i) => {
              const vendorData = vendor.vendor_id || vendor;
              const vUserId = getPartnerUserId(vendorData);
              const isAlreadyChatting = chats.some(c => getPartnerUserId(c.partner) === vUserId);
              
              if (isAlreadyChatting) return null;
              
              return (
                <FollowedVendorItem key={vUserId || `follow-${i}`} vendor={vendorData} />
              );
            })}
          </>
        )}

        {loading && (
          [...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
              <div className="w-14 h-14 rounded-full bg-[var(--bg-primary)]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-[var(--bg-primary)] rounded" />
                <div className="h-3 w-32 bg-[var(--bg-primary)] rounded" />
              </div>
            </div>
          ))
        )}

        {!loading && chats.length === 0 && followedVendors.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8">
            <MessageCircle className="w-16 h-16 text-[var(--text-secondary)]/30 mb-4" />
            <p className="text-[var(--text-secondary)] font-semibold">No conversations yet</p>
            <p className="text-[10px] text-[var(--text-secondary)] opacity-60 mt-2">Follow vendors to start chatting</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <button className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-[var(--accent)] text-white shadow-xl shadow-[var(--accent)]/40 flex items-center justify-center hover:scale-110 transition-transform z-40">
        <Plus className="w-6 h-6" />
      </button>
    </motion.div>
  );
}

function ChatItem({ chat }) {
  const partner = chat.partner || {};
  const name = getDisplayName(partner);
  const avatar = partner.avatar || partner.branding?.logo || partner.logo?.url;
  const isUnread = !chat.read_status;
  const partnerId = getPartnerUserId(partner);

  return (
    <Link href={`/chat?vendorId=${partnerId}`} className={`flex items-center gap-3 p-3 hover:bg-[var(--accent)]/5 cursor-pointer border-b border-[var(--glass-border)]/50 ${isUnread ? 'bg-[var(--accent)]/5' : ''}`}>
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] overflow-hidden border-2 border-[var(--glass-border)] shadow-sm">
          {avatar ? (
            <img src={avatar} className="w-full h-full object-cover" alt={name} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-black text-[var(--accent)]">
              {name[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>
        {partner.isOnline && (
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[var(--bg-primary)]" />
        )}
      </div>

      {/* Chat Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className={`font-bold truncate text-[13px] ${isUnread ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
            {name}
          </h3>
          <span className="text-[8px] font-bold text-[var(--text-secondary)] opacity-40 shrink-0">
            {chat.date ? new Date(chat.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
        <p className={`text-[10px] truncate ${isUnread ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)] opacity-60'}`}>
          {chat.snippet || 'Tap to start chatting'}
        </p>
      </div>

      {/* Unread Indicator */}
      {isUnread && (
        <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse shrink-0" />
      )}
    </Link>
  );
}

// Followed Vendor as WhatsApp Contact - Now identical to ChatItem
function FollowedVendorItem({ vendor }) {
  const name = getDisplayName(vendor);
  const avatar = vendor.user_id?.branding?.logo || vendor.user_id?.avatar || vendor.avatar || vendor.logo?.url || vendor.logo;
  const partnerId = getPartnerUserId(vendor);
  
  return (
    <Link href={`/chat?vendorId=${partnerId}`} className="flex items-center gap-3 p-3 hover:bg-[var(--accent)]/5 cursor-pointer border-b border-[var(--glass-border)]/50">
      {/* Avatar */}
      <div className="shrink-0">
        <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] overflow-hidden border-2 border-[var(--glass-border)] shadow-sm">
          {avatar ? (
            <img src={avatar} className="w-full h-full object-cover" alt={name} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-black text-[var(--accent)]">
              {name[0]?.toUpperCase() || 'V'}
            </div>
          )}
        </div>
      </div>

      {/* Vendor Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className="font-bold truncate text-[13px] text-[var(--text-primary)]">
            {name}
          </h3>
          <MessageCircle className="w-3 h-3 text-[var(--accent)] opacity-30" />
        </div>
        <p className="text-[10px] text-[var(--text-secondary)] opacity-60 truncate">
          Tap to start chatting
        </p>
      </div>
    </Link>
  );
}

// ===================== SHOP TAB =====================
function ShopContent({ user }) {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to shop page immediately
    router.push('/shop');
  }, [router]);
  
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: -20 }}
      className="h-full overflow-y-auto p-4 flex items-center justify-center"
    >
      <div className="text-center">
        <ShoppingBag className="w-12 h-12 text-[var(--accent)]/30 mx-auto mb-3 animate-pulse" />
        <h2 className="text-lg font-black text-[var(--text-primary)] uppercase">Redirecting to Shop...</h2>
        <p className="text-[10px] text-[var(--text-secondary)] mt-2 opacity-60">If not redirected, <Link href="/shop" className="text-[var(--accent)] font-bold underline">click here</Link></p>
      </div>
    </motion.div>
  );
}

// ===================== ORDERS TAB =====================
function OrdersContent({ user }) {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders/my-orders');
      if (res.data.success) {
        const ordersList = res.data.data.orders || [];
        setOrders(ordersList);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: -20 }}
      className="h-full overflow-y-auto"
    >
      {/* Header */}
      <div className="p-6 border-b border-[var(--glass-border)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase">Order <span className="text-[var(--accent)]">Matrix</span></h2>
            <p className="text-[10px] text-[var(--text-secondary)] opacity-60 mt-1 max-w-sm">Historical and active transaction records synchronized with the platform.</p>
          </div>
          <button onClick={fetchOrders} className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:text-[var(--accent)] transition-all">
            <RefreshCw className={`size-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-[var(--bg-primary)]/40 rounded-3xl animate-pulse border border-[var(--glass-border)]" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center p-8">
          <Package className="size-16 text-[var(--text-secondary)]/10 mb-4" />
          <p className="text-[var(--text-secondary)] font-bold text-sm tracking-widest uppercase opacity-40">No Order Records Synchronized</p>
          <p className="text-[9px] text-[var(--text-secondary)] opacity-40 mt-2">Your purchased items will appear here after checkout.</p>
        </div>
      ) : (
        <div className="p-6 space-y-4">
          {orders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((order) => (
            <Link 
              href={`/orders/${order._id}`} 
              key={order._id} 
              className="block p-6 rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:border-[var(--accent)]/40 hover:shadow-2xl transition-all group overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 size-24 bg-[var(--accent)]/5 rounded-full blur-2xl group-hover:bg-[var(--accent)]/10 transition-all" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                {/* Product & Info */}
                <div className="flex items-center gap-5 flex-1 min-w-0">
                  <div className="size-14 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex-shrink-0 overflow-hidden shadow-inner">
                    <img 
                      src={order.products?.[0]?.image || '/placeholder.png'} 
                      alt="" 
                      className="size-full object-cover" 
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-black uppercase tracking-tight group-hover:text-[var(--accent)] transition-colors line-clamp-1 text-[var(--text-primary)]">
                      {order.products?.[0]?.name || 'Encrypted Order'}
                    </h4>
                    <div className="flex items-center gap-3 mt-1.5 grayscale group-hover:grayscale-0 transition-all opacity-40 group-hover:opacity-100">
                      <span className="text-[9px] font-black uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString()}</span>
                      <div className="size-1 rounded-full bg-[var(--accent)]" />
                      <span className={`text-[9px] font-black uppercase tracking-widest ${
                        order.order_status === 'delivered' ? 'text-emerald-500' : 
                        order.order_status === 'cancelled' ? 'text-rose-500' : 'text-[var(--accent)]'
                      }`}>
                        {order.order_status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Amount & Icon */}
                <div className="flex items-center justify-between md:justify-end gap-8 pt-4 md:pt-0 border-t md:border-t-0 border-[var(--glass-border)]">
                  <div className="text-right">
                    <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-30 mb-0.5">Vault Value</p>
                    <p className="text-xl font-black font-mono text-[var(--text-primary)]">{order.total_amount?.toLocaleString() || 0} <span className="text-xs">XAF</span></p>
                  </div>
                  <div className="size-9 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white group-hover:translate-x-1 transition-all">
                    <ChevronRight className="size-4" />
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {orders.length > itemsPerPage && (
            <div className="pt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(orders.length / itemsPerPage)}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ===================== WISHLIST TAB =====================
function WishlistContent({ user }) {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      const res = await api.get('/wishlist');
      if (res.data.success) {
        const products = res.data.data.wishlist?.products || res.data.data?.products || res.data.data || [];
        setWishlist(Array.isArray(products) ? products : []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: -20 }}
      className="h-full overflow-y-auto"
    >
      {/* Header */}
      <div className="p-4 border-b border-[var(--glass-border)]">
        <h2 className="text-xl font-black text-[var(--text-primary)] uppercase">My Wishlist</h2>
      </div>

      {loading ? (
        <div className="p-4 grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 bg-[var(--bg-primary)] rounded-2xl animate-pulse border border-[var(--glass-border)]" />
          ))}
        </div>
      ) : wishlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center p-8">
          <HeartIcon className="w-16 h-16 text-[var(--text-secondary)]/30 mb-4" />
          <p className="text-[var(--text-secondary)] font-semibold">Your wishlist is empty</p>
          <p className="text-[10px] text-[var(--text-secondary)] opacity-60 mt-2">Save products you love to see them here</p>
          <Link href="/discovery" className="mt-4 px-6 py-3 bg-[var(--accent)] text-white font-black text-xs uppercase tracking-wider rounded-full">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4">
          {wishlist.map((item) => {
            const product = item.product_id || item;
            return (
              <WishlistItemCard key={product._id || item._id} product={product} />
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function WishlistItemCard({ product }) {
  const { user } = useAuthStore();
  const [addingToCart, setAddingToCart] = useState(false);

  const handleAddToCart = async (e) => {
    e.stopPropagation();
    if (!user) {
      alert('Please login to add items to cart');
      return;
    }
    setAddingToCart(true);
    try {
      cartStore.addItem(product, 1);
      await api.post('/cart', { product_id: product._id, quantity: 1 });
    } catch (err) {
      console.error(err);
      alert('Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--glass-border)] overflow-hidden">
      <div className="aspect-square relative">
        {product.images?.[0]?.url ? (
          <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[var(--bg-secondary)] flex items-center justify-center">
            <ShoppingBag className="w-8 h-8 text-[var(--accent)]/30" />
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <h4 className="text-xs font-bold text-[var(--text-primary)] line-clamp-2">{product.name}</h4>
        <p className="text-sm font-black text-[var(--accent)]">{product.price?.toLocaleString()} XAF</p>
        <button
          onClick={handleAddToCart}
          disabled={addingToCart}
          className="w-full py-2 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center gap-1 text-[10px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/30 transition-all disabled:opacity-50"
        >
          <ShoppingCart className="w-3 h-3" />
          Add to Cart
        </button>
      </div>
    </div>
  );
}
