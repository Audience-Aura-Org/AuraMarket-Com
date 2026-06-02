"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ShieldCheck, MapPin, CreditCard, ArrowRight, 
  Lock, CheckCircle2, Plus, Loader2, ChevronDown,
  Smartphone, Wallet, ArrowLeft, Gem, AlertCircle,
  Truck, Package, Info, ShieldAlert, Search, X, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import { initiateCollection, pollTransactionStatus } from '@/services/paymentProvider';
import cartStore from '@/services/cartStore';
import { useAuthStore } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { registerPWA, subscribeToPush } from '@/lib/pwa-helper';
import { applyVariantPricing, formatVariantLabel } from '@/utils/variants';

const cartLineKey = (item) => {
  const productId = item.product_id || item.product?._id || item.product;
  const variant = item.variant ? JSON.stringify(item.variant) : '';
  return `${productId || ''}:${variant}`;
};

const mergeCheckoutItems = (items = []) => {
  const merged = new Map();

  items.forEach((item) => {
    const key = cartLineKey(item);
    if (!key || key === ':') return;
    const existing = merged.get(key);

    if (existing) {
      existing.quantity += Number(item.quantity || 1);
    } else {
      merged.set(key, { ...item, quantity: Number(item.quantity || 1) });
    }
  });

  return Array.from(merged.values());
};

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  const productId = searchParams.get('productId');
  const quantity = parseInt(searchParams.get('quantity') || '1');
  const variantStr = searchParams.get('variant');
  const variant = variantStr ? JSON.parse(decodeURIComponent(variantStr)) : null;
  const { user } = useAuthStore();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    paymentMethod: 'mesomb',
    escrowEnabled: true,
    logistics_company_id: null,
    quartier: '',
    eversend: { phone: '', country: 'CM', currency: 'XAF' },
    mesomb:   { phone: '', service: '' },
  });
    
  // Eversend Country/Currency Mapping
  const eversendMap = {
    'XAF': 'CM',
    'KES': 'KE',
    'UGX': 'UG',
    'RWF': 'RW',
    'GHS': 'GH',
    'NGN': 'NG'
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [blockReason, setBlockReason] = useState(null); // null | 'insufficient_wallet' | 'collection_failed'
  const [order, setOrder] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [createdOrderIds, setCreatedOrderIds] = useState(null);
  const [logisticsFirms, setLogisticsFirms] = useState([]);
  const [logisticsLoading, setLogisticsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [logisticsOpen, setLogisticsOpen] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [zones, setZones] = useState([]);
  const [compatibleFee, setCompatibleFee] = useState(0);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [eversendCheckout, setEversendCheckout] = useState({
    active: false,
    reference: null,
    message: '',
  });

  const selectedLogistics = logisticsFirms.find(f => f._id === formData.logistics_company_id);

  const markCreatedOrdersFailed = async (reason, explicitOrderIds = null) => {
    const ids = explicitOrderIds || (orderId ? [orderId] : (createdOrderIds || []));
    if (ids.length === 0) return;
    try {
      await api.post('/payments/checkout/failed', { order_ids: ids, reason });
    } catch (err) {
      console.warn('[Checkout] Failed to close pending orders:', err?.response?.data || err.message);
    }
  };

  const handleTerminateCheckout = async () => {
    await markCreatedOrdersFailed('Customer closed checkout before payment completed.');
    router.push('/cart');
  };
  
  // 0. Fetch Zones
  useEffect(() => {
    api.get('/logistics/zones')
      .then(res => {
        if (res.data.success) {
          setZones(res.data.data.zones.filter(z => z.type === 'quartier') || []);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Compatible Firms when Quartier changes
  useEffect(() => {
    if (!formData.quartier) {
        setLogisticsFirms([]);
        setFormData(f => ({ ...f, logistics_company_id: null }));
        return;
    }
    
    const items = order?.products || cartItems;
    if (!items.length) return;

    // Extract vendor IDs — handle both order products (vendor on order) and cart items
    let vendorIds = [...new Set(items.map(it => it.vendor_id?._id || it.vendor_id || it.product?.vendor_id).filter(Boolean))];
    // For single-vendor orders the vendor is on the order object, not each product
    if (vendorIds.length === 0 && order?.vendor_id) {
      vendorIds = [order.vendor_id?._id || order.vendor_id];
    }
    if (vendorIds.length === 0) return;

    setLogisticsLoading(true);
    api.get(`/logistics/compatible-firms?quartier=${formData.quartier}&vendor_ids=${vendorIds.join(',')}`)
      .then(res => {
        if (res.data.success) {
           const firms = res.data.data.firms || [];
           setLogisticsFirms(firms);
           
           if (formData.logistics_company_id && !firms.find(f => f._id === formData.logistics_company_id)) {
              setFormData(prev => ({ ...prev, logistics_company_id: null }));
           }
        }
      })
      .catch(err => toast.error("Logistics node lookup failed"))
      .finally(() => setLogisticsLoading(false));
  }, [formData.quartier, order, cartItems]);

  useEffect(() => {
      if (formData.logistics_company_id && formData.quartier && logisticsFirms.length > 0) {
          const firm = logisticsFirms.find(f => f._id === formData.logistics_company_id);
          if (firm) {
              const qPrice = firm.quartier_prices?.find(p => p.quartier === formData.quartier)?.price || 0;
              const items = order?.products || cartItems;
              const vendorIds = [...new Set(items.map(it => it.vendor_id?._id || it.vendor_id || it.product?.vendor_id).filter(Boolean))];
              setCompatibleFee(qPrice * vendorIds.length);
          }
      } else {
          setCompatibleFee(0);
      }
  }, [formData.logistics_company_id, formData.quartier, logisticsFirms, order, cartItems]);

  // 1. Fetch Auth User Metadata & Auto-fill Profile
  useEffect(() => {
    if (user?._id) {
       // Initial fill from current user object in state
       setFormData(f => ({
         ...f,
         name: f.name || user.name || '',
         email: f.email || user.email || '',
         phone: f.phone || user.phone || '',
         city: f.city || user.onboarding_location?.city || '',
         quartier: f.quartier || user.onboarding_location?.quartier || '',
         address: f.address || user.onboarding_location?.address_description || ''
       }));

       api.get('/users/me').then(res => {
         if (res.data.success) {
            const u = res.data.data.user;
            setWalletBalance(u.wallet_balance || 0);
            
            // Re-sync if profile returned more data
            setFormData(f => ({ 
              ...f, 
              name: f.name || u.name || '',
              email: f.email || u.email || '',
              phone: f.phone || u.phone || '',
              city: f.city || u.onboarding_location?.city || '',
              quartier: f.quartier || u.onboarding_location?.quartier || '',
              address: f.address || u.onboarding_location?.address_description || ''
            }));
         }
       }).catch(() => {});
    }
  }, [user?._id]);

  // 2. Fetch Saved Addresses (Override with default if exists)
  useEffect(() => {
    if (user?._id) {
      api.get('/addresses')
        .then(res => {
          if (res.data.success) {
            const addrs = res.data.data.addresses || [];
            setSavedAddresses(addrs);
            
            // If the user has a default address, prioritize it
            const def = addrs.find(a => a.is_default) || addrs[0];
            if (def) {
              setFormData(f => ({ 
                ...f, 
                name: f.name || def.name || user.name || '', 
                phone: f.phone || def.phone || user.phone || '', 
                address: f.address || def.address_line || user.onboarding_location?.address_description || '', 
                city: f.city || def.city || user.onboarding_location?.city || '',
                email: f.email || user.email || '',
                quartier: f.quartier || def.quartier || user.onboarding_location?.quartier || ''
              }));
            }
          }
        })
        .catch(() => {});
    }
  }, [user?._id]);

  // 3. Load Order Matrix or Cart Items
  useEffect(() => {
    if (orderId) {
      api.get(`/orders/${orderId}`)
        .then(res => { 
          if (res.data.success) {
            setOrder(res.data.data.order); 
          }
        })
        .catch(err => {
          console.error('Order Sync Error:', err);
          toast.error("Failed to sync order node.");
        });
    } else if (productId) {
      // Direct product checkout
      api.get(`/products/${productId}`)
        .then(res => {
          if (res.data.success) {
            const p = res.data.data.product;
            const priced = applyVariantPricing(p, variant);
            setCartItems([{
              product_id: p._id,
              vendor_id: p.vendor_id?._id || p.vendor_id,
              vendor_name: p.vendor_id?.store_name || 'Aura Merchant Node',
              name: p.name,
              price: priced.price,
              quantity: quantity,
              image: priced.image,
              variant: priced.variant
            }]);
          }
        })
        .catch(() => toast.error("Failed to load product for checkout"));
    } else {
      api.get('/cart')
        .then(res => {
          if (res.data.success && res.data.data.cart?.items) {
             const items = res.data.data.cart.items.map(i => {
                const priced = applyVariantPricing(i.product, i.variant);
                return {
                product_id: i.product?._id || i.product,
                vendor_id: i.product?.vendor_id?._id || i.product?.vendor_id,
                vendor_name: i.product?.vendor_id?.store_name || i.product?.vendor_id?.user_id?.name || 'Aura Merchant Node',
                name: i.product?.name,
                price: priced.price,
                quantity: i.quantity,
                image: priced.image,
                variant: i.variant || null
             };
             });

             setCartItems(mergeCheckoutItems(items));
             
             // Auto-redirect if cart is empty and not viewing a specific order
             if (items.length === 0 && !orderId && !productId) {
               router.push('/overtime');
             }
          }
        })
        .catch(() => {});
    }
  }, [orderId, productId, quantity, router]);

  const handlePlaceOrder = async () => {
    // Compute amounts from the authoritative sources, not stale state
    const computedSubtotal = order?.subtotal || cartItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
    const computedDelivery = order?.shipping_fee !== undefined ? order.shipping_fee : compatibleFee;
    const totalAmount = computedSubtotal + computedDelivery;

    const isPayOnDelivery = formData.paymentMethod === 'pay_on_delivery';
    const isEversend = formData.paymentMethod === 'eversend';
    const isMesomb  = formData.paymentMethod === 'mesomb';
    const isExternal = isEversend || isMesomb;

    // Pre-check wallet balance before attempting wallet payment
    if (!isPayOnDelivery && !isExternal && walletBalance < totalAmount) {
      setBlockReason('insufficient_wallet');
      setError(`Your wallet balance (${walletBalance.toLocaleString()} XAF) is insufficient for this order (${totalAmount.toLocaleString()} XAF).`);
      return;
    }
    if (isEversend && totalAmount < 500) {
      setError(`Eversend requires a minimum payment of 500 XAF. Your current total is ${totalAmount.toLocaleString()} XAF.`);
      toast.error('Minimum amount for Eversend is 500 XAF');
      return;
    }
    if (isMesomb && totalAmount < 50) {
      setError(`Mobile Money requires a minimum payment of 50 XAF.`);
      toast.error('Minimum amount for Mobile Money is 50 XAF');
      return;
    }
    if (isMesomb && !formData.mesomb.phone && !formData.phone) {
      toast.error('Please enter your Mobile Money number.');
      return;
    }

    // MANDATORY LOGISTICS VALIDATION
    if (!formData.logistics_company_id || !formData.quartier) {
      toast.error('Logistics Critical: Please select a logistics partner and delivery zone to calculate shipment fees.');
      return;
    }
    
    setBlockReason(null);

    setLoading(true);
    setError(null);
    try {
      // Sync profile fields if updated during checkout (keeps fields in sync as requested)
      if (user?._id) {
          const updates = {};
          if (formData.phone && formData.phone !== user.phone) updates.phone = formData.phone;
          if (formData.name && formData.name !== user.name) updates.name = formData.name;
          if (Object.keys(updates).length > 0) {
              await api.patch('/auth/update-profile', updates);
              useAuthStore.getState().updateUser(updates);
          }
      }

      let finalOrderIds = orderId ? [orderId] : (createdOrderIds || []);
      
      if (!orderId && finalOrderIds.length === 0) {
         const orderPayload = {
            shipping_address: {
               street: formData.address,
               city: formData.city,
               quartier: formData.quartier,
               email: formData.email,
               phone: formData.phone
            },
            escrow_enabled: !isPayOnDelivery && formData.escrowEnabled,
            payment_method: isPayOnDelivery ? 'pay_on_delivery'
              : isEversend ? 'eversend'
              : isMesomb   ? 'mesomb'
              : (formData.escrowEnabled ? 'escrow' : 'wallet'),
            shipping_method: 'logistics_partner',
            logistics_company_id: formData.logistics_company_id,
            delivery_quartier: formData.quartier
         };

         // If direct checkout, pass the items manually to bypass cart DB
         if (productId) {
            orderPayload.items = cartItems.map(it => ({
               product_id: it.product_id,
               quantity: it.quantity,
               variant: it.variant || variant
            }));
         }

         const splitRes = await api.post('/orders/cart-split', orderPayload);

        if (splitRes.data.success) {
            finalOrderIds = splitRes.data.data.orderIds;
            setCreatedOrderIds(finalOrderIds); // Cache orders for transaction persistence
            if (!productId) {
              cartStore.clearCart();
            }
         } else {
            throw new Error("Failed to split cart into vendor nodes.");
         }
      }

      if (isMesomb) {
        const mPhone = formData.mesomb.phone || formData.phone;
        const mRes = await api.post('/payments/mesomb/initialize', {
          amount: totalAmount,
          phone: mPhone,
          service: formData.mesomb.service || undefined,
          order_ids: finalOrderIds,
        });

        if (!mRes.data.success) {
          await markCreatedOrdersFailed('MeSomb collection failed before payment completed.', finalOrderIds);
          setBlockReason('collection_failed');
          setError(mRes.data.message || 'Mobile money collection failed. Please try again.');
          setLoading(false);
          return;
        }

        const { reference, status, instructions } = mRes.data.data;

        if (status === 'SUCCESSFUL') {
          toast.success('Payment confirmed! Your order is being processed.');
          cartStore.clearCart();
          setStep(3);
          return;
        }

        // PENDING — redirect to polling page
        toast.success(instructions || 'Check your phone for a payment prompt.');
        router.push(`/wallet/verify?gateway=mesomb&type=checkout&ref=${reference}`);
        return;
      }

      if (!isExternal) {
        for (const id of finalOrderIds) {
          if (isPayOnDelivery) continue;
          if (formData.escrowEnabled) {
            await api.post('/escrow/hold', { order_id: id });
          } else {
            await api.post(`/orders/${id}/pay-direct`);
          }
        }
      } else if (isEversend) {
        setEversendCheckout({
          active: true,
          reference: null,
          message: 'Sending request to Eversend...',
        });

        const evRes = await initiateCollection('eversend', {
           amount: totalAmount,
           currency: formData.eversend.currency,
           phone: formData.eversend.phone || formData.phone,
           country: formData.eversend.country,
           order_ids: finalOrderIds,
           redirect_url: `${window.location.origin}/wallet/verify?gateway=eversend&type=checkout`,
        });

        if (!evRes.success) {
          await markCreatedOrdersFailed('Eversend collection failed before payment completed.', finalOrderIds);
          setBlockReason(walletBalance <= 0 ? 'collection_failed_no_wallet' : 'collection_failed');
          setError(evRes.message || 'Payment collection failed. Please try a different payment method.');
          setEversendCheckout({ active: false, reference: null, message: '' });
          setLoading(false);
          return;
        }

        const { reference, transaction_id } = evRes.data || {};
        const ref = reference || transaction_id;

        if (ref) {
          toast.success('Payment request sent to your phone. Please approve to complete.');
          setEversendCheckout({
            active: true,
            reference: ref,
            message: 'Charge request sent. Approve the prompt on your phone...',
          });
          setLoading(false);

          pollTransactionStatus(
            'eversend',
            ref,
            {
              onPending: (data) => setEversendCheckout((current) => ({
                ...current,
                message: data.message || 'Awaiting mobile money confirmation...',
              })),
              onSuccess: () => {
                toast.success('Payment confirmed! Your order is being processed.');
                cartStore.clearCart();
                setEversendCheckout({ active: false, reference: null, message: '' });
                setStep(3);
              },
              onFailed: (data) => {
                markCreatedOrdersFailed('Eversend collection was declined before payment completed.', finalOrderIds);
                setEversendCheckout({ active: false, reference: null, message: '' });
                setBlockReason(walletBalance <= 0 ? 'collection_failed_no_wallet' : 'collection_failed');
                setError(data.reason || 'Payment was declined by the gateway.');
              },
              onTimeout: () => {
                setEversendCheckout({ active: false, reference: null, message: '' });
                router.push(`/wallet/verify?gateway=eversend&type=checkout&ref=${ref}`);
              },
            },
            3000,
            110000
          );
          return;
        }

        setBlockReason('collection_failed');
        await markCreatedOrdersFailed('Payment gateway did not return a transaction reference.', finalOrderIds);
        setError('No transaction reference returned from the payment gateway. Please try again.');
        setEversendCheckout({ active: false, reference: null, message: '' });
        setLoading(false);
        return;
      }

      if (isPayOnDelivery) {
        toast.success('Order placed. Payment will be settled on delivery.');
      } else if (isMesomb) {
        // handled above with early return
      } else {
        toast.success(formData.paymentMethod === 'wallet' && formData.escrowEnabled ? 'Funds secured in Escrow Protocol.' : 'Direct payment completed successfully.');
      }

      cartStore.clearCart();
      toast.success('Order successfully executed!');
      setStep(3);
    } catch (err) {
      console.log('[Checkout Error Interceptor]', err.response?.status, err.response?.data);
      const msg = err?.response?.data?.message || err?.message || 'Checkout failed. Please try again.';
      setError(msg);
      setEversendCheckout({ active: false, reference: null, message: '' });
      toast.error(msg);
    } finally {
      setLoading(false);
    }

  };

  const matrixItems = order?.products || cartItems;
  const subtotal = order?.subtotal || cartItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
  const finalDeliveryFee = order?.shipping_fee !== undefined ? order.shipping_fee : compatibleFee;
  const totalAmount = subtotal + finalDeliveryFee;

  // Breakdown vendors and their fees
  const feePerVendor = selectedLogistics && formData.quartier ? (selectedLogistics.quartier_prices?.find(p => p.quartier === formData.quartier)?.price || 0) : 0;
  
  const vendorTracking = matrixItems.reduce((acc, item) => {
     const vId = item.vendor_id?._id || item.vendor_id || item.product?.vendor_id;
     if (!acc[vId]) {
        acc[vId] = { 
           id: vId, 
           name: item.vendor_name || order?.vendor_id?.store_name || order?.vendor_id?.user_id?.name || 'Merchant Enterprise',
           fee: orderId ? order.shipping_fee : feePerVendor 
        };
     }
     return acc;
  }, {});

  const vendorList = Object.values(vendorTracking);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] selection:bg-[var(--accent)]/30 overflow-x-hidden transition-colors duration-500 pb-20">
      <div className="fixed top-[-10%] right-[-10%] w-[800px] h-[800px] bg-[var(--accent)]/5 rounded-full blur-[150px] pointer-events-none -z-0"></div>
      
      <nav className="sticky top-0 z-[60] h-20 px-6 lg:px-20 flex items-center justify-between glass-panel border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/40 backdrop-blur-3xl shadow-sm">
        <button type="button" onClick={handleTerminateCheckout} className="flex items-center gap-3 group transition-all">
          <div className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white transition-all">
            <ArrowLeft className="size-5" />
          </div>
          <span className="text-[11px] lg:text-[12px]  font-semibold tracking-tight ">Terminate checkout</span>
        </button>
        <div className="flex items-center gap-8">
           <div className="hidden md:flex items-center gap-3">
              <ShieldCheck className="size-4 text-emerald-500" />
              <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-40">Encryption protocol v3.1 active</p>
           </div>
           <div className="h-8 w-px bg-[var(--glass-border)] md:block hidden" />
           <div className="flex items-center gap-4">
              <div className="text-right">
                 <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)]">Your balance</p>
                 <p className="text-sm  font-bold font-mono">{walletBalance.toLocaleString()} XAF</p>
              </div>
           </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-6 lg:px-20 py-12 relative z-10 font-poppins">

        {/* ââ Payment Blocking Screen âââââââââââââââââââââââââââââââââââââââ */}
        <AnimatePresence>
          {eversendCheckout.active && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-6 backdrop-blur-md"
            >
              <div className="w-full max-w-sm rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-8 text-center shadow-2xl">
                <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-[1.5rem] border border-[var(--accent)]/20 bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Loader2 className="size-8 animate-spin" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Approve Payment</h2>
                <p className="mt-2 text-[12px] font-semibold leading-relaxed tracking-tight text-[var(--text-secondary)] opacity-70">
                  {eversendCheckout.message || 'Waiting for mobile money confirmation...'}
                </p>
                <div className="mt-6 space-y-2 text-left">
                  {[
                    'Request sent to gateway',
                    `Approve prompt on ${formData.eversend.phone || formData.phone}`,
                    'Confirming order payment',
                  ].map((label, index) => (
                    <div key={label} className={`flex items-center gap-3 rounded-xl border p-3 ${
                      index === 0
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                        : index === 1
                          ? 'border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] opacity-50'
                    }`}>
                      <div className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                        index === 0 ? 'bg-emerald-500' : index === 1 ? 'bg-[var(--accent)]' : 'bg-[var(--glass-border)]'
                      }`}>
                        {index === 0 ? <CheckCircle2 className="size-3 text-white" /> : index === 1 ? <Loader2 className="size-3 animate-spin text-white" /> : <span className="text-[8px] font-bold text-white">{index + 1}</span>}
                      </div>
                      <p className="text-[11px] font-semibold tracking-tight">{label}</p>
                    </div>
                  ))}
                </div>
                {eversendCheckout.reference && (
                  <button
                    type="button"
                    onClick={() => router.push(`/wallet/verify?gateway=eversend&type=checkout&ref=${eversendCheckout.reference}`)}
                    className="mt-6 w-full rounded-2xl border border-[var(--glass-border)] px-4 py-3 text-[11px] font-semibold tracking-tight text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
                  >
                    Open verification page
                  </button>
                )}
              </div>
            </motion.div>
          )}
          {blockReason && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md"
            >
              <div className="w-full max-w-md bg-[var(--bg-primary)] border border-red-500/20 rounded-[2.5rem] p-10 shadow-2xl space-y-6">
                <div className="flex justify-center">
                  <div className="size-16 rounded-[1.5rem] bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    {blockReason === 'insufficient_wallet'
                      ? <Wallet className="size-8 text-red-500" />
                      : <AlertCircle className="size-8 text-red-500" />}
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-xl  font-bold tracking-tighter text-[var(--text-primary)]">
                    {blockReason === 'insufficient_wallet'
                      ? 'Insufficient Wallet Balance'
                      : blockReason === 'collection_failed_no_wallet'
                      ? 'Purchase Could Not Be Completed'
                      : 'Payment Collection Failed'}
                  </h2>
                  <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-70 tracking-tight leading-relaxed">
                    {blockReason === 'collection_failed_no_wallet'
                      ? 'Your wallet has insufficient funds and the payment collection failed. Please top up your wallet or use a different payment method.'
                      : error}
                  </p>
                </div>
                <div className="space-y-3">
                  {blockReason !== 'insufficient_wallet' && (
                    <button
                      onClick={() => { setBlockReason(null); setError(null); }}
                      className="w-full h-12 rounded-2xl bg-[var(--accent)] text-white  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--accent)]/20"
                    >
                      <RotateCcw className="size-4" />
                      Retry Payment
                    </button>
                  )}
                  <button
                    onClick={() => router.push('/wallet')}
                    className="w-full h-12 rounded-2xl border border-[var(--glass-border)] text-[var(--text-primary)]  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-2 hover:border-[var(--accent)]/40 transition-all"
                  >
                    <Wallet className="size-4" />
                    Top Up Wallet
                  </button>
                  <button
                    onClick={() => { setBlockReason(null); setError(null); setFormData(f => ({ ...f, paymentMethod: 'pay_on_delivery' })); }}
                    className="w-full h-12 rounded-2xl border border-[var(--glass-border)] text-[var(--text-secondary)]  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-2 hover:border-[var(--accent)]/40 transition-all"
                  >
                    Use Different Method
                  </button>
                  <button
                    onClick={() => router.push('/cart')}
                    className="w-full h-12 rounded-2xl border border-red-500/20 text-red-400  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-2 hover:bg-red-500/5 transition-all"
                  >
                    Cancel Order
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-8 space-y-12">
            <div className="flex items-center gap-4 mb-4">
               {[
                  { id: 1, label: 'Fulfillment' },
                  { id: 2, label: 'Confirmation' },
                  { id: 3, label: 'Success' }
                ].map((s) => (
                  <button 
                   key={s.id}
                   onClick={() => s.id < step && setStep(s.id)}
                   className={`flex-1 h-2 rounded-full transition-all duration-700 relative group overflow-hidden ${step >= s.id ? 'bg-[var(--accent)]' : 'bg-[var(--glass-border)]'}`}
                  >
                     {step === s.id && <div className="absolute inset-x-0 h-full bg-white/30 animate-pulse" />}
                     <span className={`absolute top-4 left-0 text-[11px] lg:text-[12px]  font-semibold tracking-tight transition-opacity duration-300 ${step === s.id ? 'opacity-100' : 'opacity-20 group-hover:opacity-100'}`}>
                       {s.label}
                     </span>
                  </button>
                ))}
            </div>

            <div className="pt-8">
              {/* Existing Step 1 & 2 content ... */}
              {step === 1 && (
                <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="space-y-10">
                    <div className="flex items-center gap-6">
                       <div className="size-16 rounded-[28px] bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 flex items-center justify-center shadow-lg"><MapPin className="size-8" /></div>
                       <div>
                          <h2 className="text-4xl  font-bold tracking-tighter  leading-none">Fulfillment <span className="text-[var(--accent)]">Node</span></h2>
                          <p className="text-sm font-medium text-[var(--text-secondary)] mt-2">Specify delivery coordinates and security protocol.</p>
                       </div>
                    </div>

                    <div className="glass-panel p-5 md:p-10 rounded-3xl md:rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 space-y-6 md:space-y-10">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-10">
                          <div className="space-y-2 md:space-y-3">
                            <label className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  ml-1">Consignee Name</label>
                            <input 
                              placeholder="Full Name"
                              value={formData.name}
                              onChange={e => setFormData({...formData, name: e.target.value})}
                              className="w-full px-5 md:px-8 py-3.5 md:py-5 rounded-xl md:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-[var(--accent)] transition-all outline-none text-sm  font-bold"
                            />
                          </div>
                          <div className="space-y-2 md:space-y-3">
                            <label className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  ml-1">Comms Protocol (Phone)</label>
                            <input 
                              placeholder="+237 ..."
                              value={formData.phone}
                              onChange={e => setFormData({...formData, phone: e.target.value})}
                              className="w-full px-5 md:px-8 py-3.5 md:py-5 rounded-xl md:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-[var(--accent)] transition-all outline-none text-sm  font-bold"
                            />
                          </div>
                          <div className="md:col-span-2 space-y-2 md:space-y-3">
                            <label className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  ml-1">Handshake Email</label>
                            <input 
                              type="email"
                              placeholder="email@example.com"
                              value={formData.email}
                              onChange={e => setFormData({...formData, email: e.target.value})}
                              className="w-full px-5 md:px-8 py-3.5 md:py-5 rounded-xl md:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-[var(--accent)] transition-all outline-none text-sm  font-bold"
                            />
                          </div>
                          

                          <div className="md:col-span-2 space-y-3 md:space-y-4">
                            <label className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  ml-1">Delivery Quartier (Zone)</label>
                            <div className="relative">
                               <button 
                                  type="button"
                                  onClick={() => setZoneOpen(!zoneOpen)}
                                  className={`w-full flex items-center justify-between px-5 md:px-8 py-3.5 md:py-5 rounded-xl md:rounded-2xl bg-[var(--bg-secondary)] border transition-all outline-none ${zoneOpen ? 'border-[var(--accent)]' : 'border-[var(--glass-border)]'}`}
                               >
                                  <div className="flex items-center gap-4">
                                     <MapPin className="size-5 text-[var(--accent)] opacity-40" />
                                     <span className={`text-sm  font-bold ${formData.quartier ? '' : 'opacity-30'}`}>
                                        {formData.quartier || 'Search and select your zone...'}
                                     </span>
                                  </div>
                                  <ChevronDown className={`size-4 opacity-40 transition-transform ${zoneOpen ? 'rotate-180' : ''}`} />
                               </button>

                               <SearchableZoneDropdown 
                                  open={zoneOpen}
                                  selected={formData.quartier}
                                  onSelect={(val) => setFormData({...formData, quartier: val})}
                                  onClose={() => setZoneOpen(false)}
                                  zones={zones}
                               />

                            </div>
                          </div>

                          <div className="md:col-span-2 space-y-2 md:space-y-3">
                            <label className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  ml-1">Precise Landing Details (Build/Street No.)</label>
                            <textarea 
                              placeholder="House number, color of gate, or specific landmarks..."
                              rows={3}
                              value={formData.address}
                              onChange={e => setFormData({...formData, address: e.target.value})}
                              className="w-full px-5 md:px-8 py-3.5 md:py-5 rounded-xl md:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-[var(--accent)] transition-all outline-none text-sm  font-bold resize-none"
                            />
                          </div>

                       </div>

                       <div className="pt-4 space-y-4">
                          <label className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  ml-1">Logistics Partner</label>
                          <div className="relative">
                             <button 
                                type="button"
                                onClick={() => setLogisticsOpen(!logisticsOpen)}
                                className={`w-full flex items-center justify-between pl-6 pr-8 py-4 rounded-2xl bg-[var(--bg-secondary)] border transition-all outline-none ${logisticsOpen ? 'border-[var(--accent)]' : 'border-[var(--glass-border)]'}`}
                             >
                                <div className="flex items-center gap-4 min-w-0">
                                   <div className="size-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0">
                                      {formData.logistics_company_id && selectedLogistics ? (
                                         <img 
                                           src={selectedLogistics.user_id?.branding?.logo || selectedLogistics.user_id?.avatar} 
                                           className="size-full object-cover" 
                                           alt="" 
                                         />
                                      ) : (
                                         <Truck className="size-5 text-[var(--accent)] opacity-20" />
                                      )}
                                   </div>
                                   <div className="text-left min-w-0">
                                      {formData.logistics_company_id && selectedLogistics ? (
                                        <>
                                          <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight truncate">
                                             {selectedLogistics.company_name}
                                          </p>
                                          <p className="text-[11px] lg:text-[12px]  font-semibold  text-[var(--text-secondary)] opacity-60 truncate">
                                             {selectedLogistics.user_id?.name || 'Verified Node'}
                                          </p>
                                        </>
                                      ) : (
                                        <span className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-30">Select Logistics Node</span>
                                      )}
                                   </div>
                                </div>
                                <ChevronDown className={`size-4 opacity-40 transition-transform ${logisticsOpen ? 'rotate-180' : ''}`} />
                             </button>

                             <SearchableLogisticsDropdown 
                                firms={logisticsFirms}
                                selectedId={formData.logistics_company_id}
                                onSelect={(id) => setFormData({...formData, logistics_company_id: id})}
                                loading={logisticsLoading}
                                open={logisticsOpen}
                                onClose={() => setLogisticsOpen(false)}
                             />
                          </div>

                       </div>

                       <div className="pt-4 space-y-4">
                           <label className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  ml-1">Payment Strategy</label>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               {/* ── Eversend ─────────────────────────────── */}
                               <button 
                                onClick={() => setFormData({...formData, paymentMethod: 'eversend', eversend: { ...formData.eversend, phone: formData.phone }})}
                                className={`order-2 p-6 rounded-[32px] border text-left transition-all relative group overflow-hidden ${formData.paymentMethod === 'eversend' ? 'bg-[var(--accent)]/5 border-[var(--accent)] shadow-sm' : 'bg-transparent border-[var(--glass-border)] opacity-60'}`}
                               >
                                  <div className="flex items-center justify-between mb-4">
                                     <div className="flex items-center gap-2">
                                        <Smartphone className={`size-5 ${formData.paymentMethod === 'eversend' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
                                        <span className="text-[11px] lg:text-[12px]  font-semibold  tracking-tighter">Eversend (500 XAF min)</span>
                                     </div>
                                     {formData.paymentMethod === 'eversend' && <CheckCircle2 className="size-4 text-[var(--accent)]" />}
                                  </div>
                                  <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] font-medium leading-relaxed">Multi-country mobile money. Checkout amount must be at least 500 XAF.</p>
                               </button>

                               {/* ── MeSomb ───────────────────────────────── */}
                               <button 
                                onClick={() => setFormData({...formData, paymentMethod: 'mesomb', mesomb: { ...formData.mesomb, phone: formData.mesomb.phone || formData.phone }})}
                                className={`order-1 p-5 sm:p-6 rounded-[28px] border text-left transition-all group overflow-hidden ${formData.paymentMethod === 'mesomb' ? 'bg-[var(--accent)]/5 border-[var(--accent)] shadow-sm' : 'bg-transparent border-[var(--glass-border)] opacity-60'}`}
                               >
                                  <div className="flex items-start justify-between gap-3 mb-4">
                                     <div className="min-w-0 space-y-1.5">
                                        <div className="flex min-w-0 items-center gap-2">
                                          <Smartphone className={`size-5 shrink-0 ${formData.paymentMethod === 'mesomb' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
                                          <span className="truncate text-[11px] lg:text-[12px] font-semibold tracking-tight">MTN / Orange Money</span>
                                        </div>
                                        <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500">Primary</span>
                                     </div>
                                     {formData.paymentMethod === 'mesomb' && <CheckCircle2 className="size-4 shrink-0 text-[var(--accent)]" />}
                                  </div>
                                  <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] font-medium leading-relaxed">Direct USSD prompt — MTN MoMo &amp; Orange Money (XAF).</p>
                               </button>

                               <button 
                                onClick={() => setFormData({...formData, paymentMethod: 'wallet', escrowEnabled: formData.escrowEnabled})}
                                className={`order-3 p-6 rounded-[32px] border text-left transition-all relative group overflow-hidden ${formData.paymentMethod === 'wallet' ? 'bg-[var(--accent)]/5 border-[var(--accent)] shadow-sm' : 'bg-transparent border-[var(--glass-border)] opacity-60'}`}
                               >
                                  <div className="flex items-center justify-between mb-4">
                                     <div className="flex items-center gap-2">
                                        <CreditCard className={`size-5 ${formData.paymentMethod === 'wallet' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
                                        <span className="text-[11px] lg:text-[12px]  font-semibold  tracking-tighter">Aura Wallet</span>
                                     </div>
                                     {formData.paymentMethod === 'wallet' && <CheckCircle2 className="size-4 text-[var(--accent)]" />}
                                  </div>
                                  <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] font-medium leading-relaxed">Immediate settlement from your Aura Wallet balance.</p>
                               </button>

                              <button
                               onClick={() => setFormData({...formData, escrowEnabled: false, paymentMethod: 'pay_on_delivery'})}
                               className={`order-4 p-6 rounded-[32px] border text-left transition-all relative group overflow-hidden ${formData.paymentMethod === 'pay_on_delivery' ? 'bg-[var(--accent)]/5 border-[var(--accent)] shadow-sm' : 'bg-transparent border-[var(--glass-border)] opacity-60'}`}
                              >
                                 <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                       <Truck className={`size-5 ${formData.paymentMethod === 'pay_on_delivery' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
                                       <span className="text-[11px] lg:text-[12px]  font-semibold  tracking-tighter">Pay on Delivery</span>
                                    </div>
                                    {formData.paymentMethod === 'pay_on_delivery' && <CheckCircle2 className="size-4 text-[var(--accent)]" />}
                                 </div>
                                 <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] font-medium leading-relaxed">Payment is settled when logistics confirms delivery.</p>
                              </button>
                           </div>

                           {formData.paymentMethod !== 'pay_on_delivery' && (
                              <div className="mt-4 p-6 rounded-[32px] bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500 hover:border-[var(--accent)]/30 transition-all cursor-pointer"
                                   onClick={() => setFormData({...formData, escrowEnabled: !formData.escrowEnabled})}>
                                 <div className="flex items-center gap-4">
                                    <div className={`size-12 rounded-2xl flex items-center justify-center transition-all ${formData.escrowEnabled ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] opacity-40 border border-[var(--glass-border)]'}`}>
                                       <ShieldCheck className="size-6" />
                                    </div>
                                    <div>
                                       <p className={`text-[11px] lg:text-[12px]  font-semibold tracking-tight ${formData.escrowEnabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] opacity-60'}`}>Aura Escrow Protection</p>
                                       <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] font-medium opacity-60 mt-1  tracking-tighter">Secure funds until delivery confirmation, including mobile money checkout</p>
                                    </div>
                                 </div>
                                 <div className={`w-12 h-6 rounded-full flex items-center p-1 transition-all ${formData.escrowEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--text-secondary)]/20'}`}>
                                    <div className={`size-4 bg-white rounded-full shadow-sm transition-transform transform ${formData.escrowEnabled ? 'translate-x-[24px]' : 'translate-x-0'}`} />
                                 </div>
                              </div>
                           )}

                           {formData.paymentMethod === 'mesomb' && (
                              <div className="mt-4 p-6 rounded-[32px] bg-[var(--accent)]/5 border border-[var(--accent)]/20 animate-in fade-in slide-in-from-top-4 duration-500">
                                 <p className="text-[10px] lg:text-[11px] font-semibold tracking-widest uppercase text-[var(--accent)] mb-4 opacity-70">Mobile Money Details</p>
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                       <label className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-60 ml-1">MoMo / Orange Number</label>
                                       <input 
                                          type="tel"
                                          placeholder="677 XXX XXX or 690 XXX XXX"
                                          value={formData.mesomb.phone}
                                          onChange={e => setFormData({...formData, mesomb: {...formData.mesomb, phone: e.target.value}})}
                                          className="w-full h-14 px-6 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[11px] lg:text-[12px]  font-semibold  outline-none focus:border-[var(--accent)] transition-all"
                                       />
                                    </div>
                                    <div className="space-y-2">
                                       <label className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-60 ml-1">Network</label>
                                       <select
                                          value={formData.mesomb.service}
                                          onChange={e => setFormData({...formData, mesomb: {...formData.mesomb, service: e.target.value}})}
                                          className="w-full h-14 px-6 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[11px] lg:text-[12px]  font-semibold  outline-none focus:border-[var(--accent)] transition-all"
                                       >
                                          <option value="">Auto-detect from number</option>
                                          <option value="MTN">MTN Mobile Money</option>
                                          <option value="ORANGE">Orange Money</option>
                                       </select>
                                    </div>
                                 </div>
                                 <p className="text-[10px] text-[var(--text-secondary)] opacity-50 mt-3 leading-relaxed">
                                    💡 A USSD prompt will be sent to your phone. Approve it to complete payment.
                                 </p>
                              </div>
                           )}

                           {formData.paymentMethod === 'eversend' && (
                              <div className="mt-4 p-6 rounded-[32px] bg-[var(--accent)]/5 border border-[var(--accent)]/20 animate-in fade-in slide-in-from-top-4 duration-500">
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                       <label className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-60 ml-1">Collection Number</label>
                                       <input 
                                          type="text"
                                          placeholder="+237..."
                                          value={formData.eversend.phone}
                                          onChange={e => setFormData({...formData, eversend: {...formData.eversend, phone: e.target.value}})}
                                          className="w-full h-14 px-6 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[11px] lg:text-[12px]  font-semibold  outline-none focus:border-[var(--accent)] transition-all"
                                       />
                                    </div>
                                    <div className="space-y-2">
                                       <label className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-60 ml-1">Currency</label>
                                       <div className="w-full h-14 px-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[11px] lg:text-[12px]  font-semibold flex items-center gap-3 cursor-not-allowed select-none">
                                          <span className="text-[var(--text-primary)]">XAF</span>
                                          <span className="text-[var(--text-secondary)] opacity-50">— Central African Franc</span>
                                          <span className="ml-auto text-[10px] lg:text-[12px]  font-semibold tracking-widest bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-1 rounded-lg">LOCKED</span>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>

                     <button 
                        onClick={handlePlaceOrder}
                        disabled={loading}
                        className="w-full h-16 rounded-2xl bg-[var(--text-primary)] text-[var(--bg-primary)]  font-semibold text-[10px] lg:text-[12px] tracking-[0.3em]  hover:bg-[var(--accent)] hover:text-white transition-all shadow-xl active:scale-95 disabled:opacity-20 mt-8 flex items-center justify-center gap-3"
                      >
                        {loading ? (
                          <div className="size-4 border-2 border-[var(--bg-primary)] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            SECURE CHECKOUT
                            <ArrowRight className="size-4" />
                          </>
                        )}
                      </button>
                  </div>
                </section>
              )}
              {step === 999 && (
                <section className="animate-in fade-in zoom-in-95 duration-700">
                   <div className="space-y-12">
                      <div className="flex items-center gap-6">
                        <div className="size-16 rounded-[28px] bg-black text-white flex items-center justify-center shadow-2xl"><CheckCircle2 className="size-8" /></div>
                        <div>
                          <h2 className="text-4xl  font-bold tracking-tighter  leading-none">Matrix <span className="text-[var(--accent)]">Review</span></h2>
                          <p className="text-sm font-medium text-[var(--text-secondary)] mt-2">Validate full transaction vector before execution.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="p-8 rounded-[40px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 space-y-2">
                            <p className="text-[11px] lg:text-[12px]  font-semibold  text-[var(--text-secondary)] tracking-tight mb-6 opacity-40">Authorized Consignee</p>
                            <p className="text-xl  font-bold text-[var(--text-primary)]">{formData.name}</p>
                            <p className="text-xs text-[var(--text-secondary)]  font-bold mb-2">{formData.email}</p>
                            <p className="text-sm  font-bold text-[var(--text-secondary)] flex items-start gap-2">
                               <MapPin className="size-4 shrink-0 mt-0.5 text-[var(--accent)]" /> {formData.address}
                            </p>
                         </div>
                         <div className="p-8 rounded-[40px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 flex flex-col justify-between">
                            <div className="flex items-center gap-4">
                              {formData.paymentMethod === 'pay_on_delivery'
                                 ? <Truck className="size-10 text-emerald-500" />
                                 : (formData.escrowEnabled ? <ShieldCheck className="size-10 text-emerald-500" /> : <CreditCard className="size-10 text-emerald-500" />)}
                               <div>
                                  <p className="text-xl  font-bold text-[var(--text-primary)] tracking-tight">{formData.paymentMethod === 'pay_on_delivery' ? 'Pay on Delivery' : (formData.escrowEnabled ? 'Escrow Secured' : 'Direct Payout')}</p>
                                  <p className="text-xs font-medium text-[var(--text-secondary)] opacity-60">{formData.paymentMethod === 'pay_on_delivery' ? 'Payment after delivery confirmation' : (formData.escrowEnabled ? 'Handshake secured' : 'Immediate transfer protocol')}</p>
                               </div>
                            </div>
                             {selectedLogistics && (
                                <div className="mt-6 pt-6 border-t border-[var(--glass-border)] flex items-center gap-5 group">
                                   <div className="size-12 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden group-hover:scale-105 transition-all">
                                      {selectedLogistics.user_id?.branding?.logo || selectedLogistics.user_id?.avatar
                                        ? <img src={selectedLogistics.user_id?.branding?.logo || selectedLogistics.user_id?.avatar} className="w-full h-full object-cover" alt="Node Logo" />
                                        : <Truck className="size-6 text-[var(--accent)] opacity-20" />
                                      }
                                   </div>
                                   <div className="flex-1">
                                      <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] mb-1 opacity-60">Logistics Assigned</p>
                                      <p className="text-sm  font-bold text-[var(--text-primary)] tracking-tight truncate leading-none">
                                         {selectedLogistics.company_name}
                                      </p>
                                      <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] tracking-tight mt-1 opacity-80">Verified AURA Node</p>
                                   </div>
                                </div>
                            )}

                      </div>
                      </div>

                      <div className={`${formData.escrowEnabled && formData.paymentMethod !== 'pay_on_delivery' ? 'bg-amber-500/5 border-amber-500/10' : 'bg-emerald-500/5 border-emerald-500/10'} border p-8 rounded-[40px] flex items-start gap-6 relative overflow-hidden`}>
                         <div className={`absolute inset-y-0 left-0 w-1.5 ${formData.escrowEnabled && formData.paymentMethod !== 'pay_on_delivery' ? 'bg-amber-500/40' : 'bg-emerald-500/40'}`} />
                         {formData.escrowEnabled && formData.paymentMethod !== 'pay_on_delivery' ? <ShieldAlert className="size-8 text-amber-500 shrink-0" /> : <Info className="size-8 text-emerald-500 shrink-0" />}
                         <div className="space-y-2">
                            <h5 className={`text-[11px] lg:text-[12px]  font-semibold  tracking-[0.2em] ${formData.escrowEnabled && formData.paymentMethod !== 'pay_on_delivery' ? 'text-amber-600' : 'text-emerald-600'}`}>{formData.escrowEnabled && formData.paymentMethod !== 'pay_on_delivery' ? 'Smart Contract Disclosure' : 'Direct Payout Disclosure'}</h5>
                            <p className="text-xs font-medium text-[var(--text-secondary)]">
                               {formData.paymentMethod === 'pay_on_delivery'
                                 ? <>By executing this order, payment stays pending and is completed on delivery confirmation for test logistics flow.</>
                                 : formData.escrowEnabled
                                 ? <>By executing this order, you authorize the platform to hold <span className="text-[var(--text-primary)]  font-bold">{(totalAmount).toLocaleString()} XAF</span> in Escrow vault.</>
                                 : <>By executing this order, you authorize the immediate transfer of <span className="text-[var(--text-primary)]  font-bold">{(totalAmount).toLocaleString()} XAF</span> to the vendor's wallet.</>
                               }
                            </p>
                         </div>
                      </div>
                   </div>
                </section>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 h-fit sticky top-36">
            <div className="glass-panel p-10 rounded-[56px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-3xl shadow-4xl relative overflow-hidden">
               <h3 className="text-3xl  font-bold mb-10 tracking-tighter  leading-none">Order <span className="text-[var(--accent)]">Matrix</span></h3>
               <div className="space-y-6 max-h-[300px] overflow-y-auto no-scrollbar pr-2 mb-12">
                  {matrixItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 group">
                       <img src={item.image || '/placeholder.png'} className="size-14 rounded-2xl object-cover border border-[var(--glass-border)]" alt="" />
                       <div className="flex-1 min-w-0">
                          <p className="text-xs  font-bold text-[var(--text-primary)] truncate ">{item.name}</p>
                          {formatVariantLabel(item.variant) && (
                            <p className="mt-0.5 truncate text-[10px] font-semibold text-[var(--accent)]/80">
                              {formatVariantLabel(item.variant)}
                            </p>
                          )}
                          <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] font-mono">{item.price?.toLocaleString()} XAF x {item.quantity}</p>
                       </div>
                    </div>
                  ))}
               </div>
               
               <div className="space-y-6 py-10 border-t border-[var(--glass-border)]">
                   <div className="flex justify-between items-center text-[11px] lg:text-[12px]  font-semibold tracking-[0.2em] text-[var(--text-secondary)] ">
                      <span className="opacity-40">Cart Subtotal</span>
                      <span className="text-xs font-mono">{subtotal.toLocaleString()} XAF</span>
                   </div>
                   
                   {compatibleFee > 0 && selectedLogistics && (
                      <div className="space-y-4 pt-4 border-t border-[var(--glass-border)]/20 animate-in fade-in duration-500">
                         <div className="flex items-center justify-between mb-2">
                           <p className="text-[11px] lg:text-[12px]  font-semibold  text-[var(--accent)] tracking-tight flex items-center gap-2">
                             <Truck className="size-3" /> Delivery Fees
                           </p>
                           <p className="text-[11px] lg:text-[12px] font-mono  font-semibold text-[var(--accent)]">{compatibleFee.toLocaleString()} XAF</p>
                         </div>
                         <div className="space-y-2">
                           {vendorList.map((v, i) => (
                             <div key={i} className="flex justify-between items-center opacity-70">
                               <p className="text-[11px] lg:text-[12px]  font-semibold  text-[var(--text-secondary)]">
                                 From {v.name}
                               </p>
                               <p className="text-[10px] lg:text-[12px] font-mono">+{v.fee.toLocaleString()} XAF</p>
                             </div>
                           ))}
                         </div>
                      </div>
                   )}

                   <div className="flex justify-between items-end pt-8 border-t border-[var(--glass-border)]/50">
                      <div>
                         <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)]  tracking-[0.4em] mb-1">Final Settlement</p>
                         <p className="text-5xl  font-bold text-[var(--text-primary)] font-mono tracking-tighter tabular-nums">{totalAmount.toLocaleString()}</p>
                      </div>
                      <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40  pb-2">XAF</p>
                   </div>
                </div>

                {step === 999 && (
                 <div className="space-y-6">
                   <button 
                     onClick={handlePlaceOrder}
                     disabled={loading || !formData.logistics_company_id}
                     className={`w-full h-20 rounded-3xl font-semibold text-[11px] lg:text-[12px] tracking-[0.4em] shadow-3xl transition-all duration-500 flex items-center justify-center gap-4 group ${
                        !formData.logistics_company_id 
                          ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed grayscale' 
                          : 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:bg-[var(--accent)] hover:text-white'
                     } disabled:opacity-50`}
                    >
                     {loading ? (
                       <span className="flex items-center gap-3">
                         <Loader2 className="size-5 animate-spin" /> 
                         Transaction...
                       </span>
                     ) : (
                       <>
                         Secure Checkout 
                         <ArrowRight className="size-6 group-hover:translate-x-2 transition-all" />
                       </>
                     )}
                   </button>
                 </div>
               )}

               {step === 3 && (
                <section className="animate-in fade-in zoom-in-95 duration-1000">
                  <div className="max-w-2xl mx-auto text-center space-y-10 py-12">
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-[var(--accent)] blur-[80px] opacity-20 animate-pulse"></div>
                      <div className="size-32 rounded-[48px] bg-black text-white flex items-center justify-center shadow-2xl relative">
                        <CheckCircle2 className="size-16 animate-bounce" />
                      </div>
                    </div>
                    
                    <div>
                      <h2 className="text-5xl  font-bold tracking-tighter  mb-4">Order <span className="text-[var(--accent)]">Successful</span></h2>
                      <p className="text-sm font-medium text-[var(--text-secondary)]">Your order has been placed and is being prepared for delivery.</p>
                    </div>



                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <Link 
                        href="/orders"
                        className="w-full h-16 rounded-3xl bg-[var(--text-primary)] text-[var(--bg-primary)]  font-semibold text-[10px] lg:text-[12px] tracking-tight  flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] transition-all"
                      >
                         <Package className="size-4" /> Go to My Orders
                      </Link>
                      <Link 
                        href="/discovery"
                        className="w-full h-16 rounded-3xl glass-panel border border-[var(--glass-border)] text-[var(--text-primary)]  font-semibold text-[10px] lg:text-[12px] tracking-tight  flex items-center justify-center gap-3 hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-all"
                      >
                         Continue Exploring <ArrowRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                </section>
               )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SearchableZoneDropdown({ open, selected, onSelect, onClose, zones }) {
  const [query, setQuery] = useState('');
  
  if (!open) return null;

  const filtered = (zones || []).filter(z => 
    z.name?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="absolute top-full left-0 w-full mt-3 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 z-[110]">
      <div className="p-4 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30">
         <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3 opacity-20 group-focus-within:text-[var(--accent)] transition-all" />
            <input 
               autoFocus
               placeholder="Search Quartier..."
               value={query}
               onChange={e => setQuery(e.target.value)}
               className="w-full bg-transparent pl-10 pr-4 py-2 !text-base placeholder:!text-base font-semibold tracking-tight outline-none"
            />
         </div>
      </div>
      <div className="max-h-[300px] overflow-y-auto no-scrollbar">
         {filtered.length === 0 ? (
            <div className="p-8 text-center opacity-30">
               <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight">No zones found</p>
            </div>
         ) : (
            filtered.map(z => (
               <button
                  key={z._id || z.name}
                  onClick={() => { onSelect(z.name); onClose(); }}
                  className={`w-full p-4 flex items-center gap-4 hover:bg-[var(--accent)]/5 transition-all text-left ${selected === z.name ? 'bg-[var(--accent)]/10' : ''}`}
               >
                  <MapPin className="size-4 opacity-20 text-[var(--accent)]" />
                  <div className="min-w-0 flex-1">
                     <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight truncate">{z.name}</p>
                  </div>
                  {selected === z.name && <CheckCircle2 className="size-4 text-[var(--accent)]" />}
               </button>
            ))
         )}
      </div>
    </div>
  );
}

function SearchableLogisticsDropdown({ firms, selectedId, onSelect, loading, open, onClose }) {

  const [query, setQuery] = useState('');
  
  if (!open) return null;

  const filtered = firms.filter(f => 
    f.company_name?.toLowerCase().includes(query.toLowerCase()) || 
    f.user_id?.name?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="absolute top-full left-0 w-full mt-3 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 z-[100]">
      <div className="p-4 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30">
         <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3 opacity-20 group-focus-within:text-[var(--accent)] transition-all" />
            <input 
               autoFocus
               placeholder="Search Logistics Node..."
               value={query}
               onChange={e => setQuery(e.target.value)}
               className="w-full bg-transparent pl-10 pr-4 py-2 !text-base placeholder:!text-base font-semibold tracking-tight outline-none"
            />
         </div>
      </div>
      <div className="max-h-[300px] overflow-y-auto no-scrollbar">
         {loading ? (
            <div className="p-8 flex items-center justify-center">
               <Loader2 className="size-5 animate-spin text-[var(--accent)]" />
            </div>
         ) : filtered.length === 0 ? (
            <div className="p-8 text-center opacity-30">
               <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight">No nodes found</p>
            </div>
         ) : (
            filtered.map(f => (
               <button
                  key={f._id}
                  onClick={() => { onSelect(f._id); onClose(); }}
                  className={`w-full p-4 flex items-center gap-4 hover:bg-[var(--accent)]/5 transition-all text-left ${selectedId === f._id ? 'bg-[var(--accent)]/10' : ''}`}
               >
                  <div className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0">
                     {f.user_id?.branding?.logo || f.user_id?.avatar ? (
                        <img src={f.user_id?.branding?.logo || f.user_id?.avatar} className="size-full object-cover" alt="" />
                     ) : (
                        <Truck className="size-5 opacity-20" />
                     )}
                  </div>
                  <div className="min-w-0 flex-1">
                     <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight truncate">{f.company_name}</p>
                     <p className="text-[11px] lg:text-[12px]  font-semibold  text-[var(--text-secondary)] opacity-60 truncate">
                        {f.user_id?.name || 'Authorized Lead'}
                     </p>
                  </div>
                  {selectedId === f._id && <CheckCircle2 className="size-4 text-[var(--accent)]" />}
               </button>
            ))
         )}
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CheckoutContent />
    </Suspense>
  );
}

