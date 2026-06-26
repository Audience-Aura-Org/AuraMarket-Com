"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { flushSync } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ShieldCheck, MapPin, CreditCard, ArrowRight, 
  Lock, CheckCircle2, Plus, Loader2, ChevronDown,
  Smartphone, Wallet, ArrowLeft, Gem, AlertCircle,
  Truck, Package, Info, ShieldAlert, Search, X, RotateCcw, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import { initiateCollection, pollTransactionStatus } from '@/services/paymentProvider';
import cartStore from '@/services/cartStore';
import { useAuthStore } from '@/hooks/useAuth';
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

const VENDOR_MANAGED_LOGISTICS_ID = 'vendor_managed';
const MOBILE_MONEY_COLLECTION_FEE_XAF = 50;
const isMobileMoneyPayment = (method) => ['payunit', 'eversend'].includes(method);
const normalizeZoneName = (value) => String(value || '').trim();
const getZoneName = (zone) => {
  if (typeof zone === 'string') return normalizeZoneName(zone);
  return normalizeZoneName(zone?.name || zone?.label || zone?.title || zone?.zone_name || '');
};
const CHECKOUT_QUARTIER_KEY = 'checkout_delivery_quartier';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  const productId = searchParams.get('productId');
  const quantity = parseInt(searchParams.get('quantity') || '1');
  const variantStr = searchParams.get('variant');
  const variant = variantStr ? JSON.parse(decodeURIComponent(variantStr)) : null;
  const { user, setWalletBalance: setSharedWalletBalance, walletBalance, refreshWalletBalance } = useAuthStore();
  const displayedWalletBalance = Number(walletBalance ?? 0);
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    paymentMethod: 'payunit',
    escrowEnabled: true,
    logistics_company_id: VENDOR_MANAGED_LOGISTICS_ID,
    payunit: { phone: '', provider: 'CM_MTNMOMO', country: 'CM', currency: 'XAF' },
    eversend: { phone: '', country: 'CM', currency: 'XAF' },
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
  const [createdOrderIds, setCreatedOrderIds] = useState(null);
  const [logisticsFirms, setLogisticsFirms] = useState([]);
  const [logisticsLoading, setLogisticsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [logisticsOpen, setLogisticsOpen] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [zones, setZones] = useState([]);
  const [deliveryQuartier, setDeliveryQuartier] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [removingItemKey, setRemovingItemKey] = useState(null);
  const [minimumWarningsDismissed, setMinimumWarningsDismissed] = useState(false);
  const [eversendCheckout, setEversendCheckout] = useState({
    active: false,
    reference: null,
    message: '',
  });
  const [checkoutTotals, setCheckoutTotals] = useState(null);
  const deliveryQuartierTouchedRef = useRef(false);
  const profileHydratedRef = useRef(false);

  const handleQuartierChange = (zone) => {
    const normalized = getZoneName({ name: zone });
    if (!normalized) return;
    deliveryQuartierTouchedRef.current = true;
    setDeliveryQuartier(normalized);
  };

  const sumLineItems = (items = []) =>
    items.reduce(
      (acc, it) => acc + (Number(it.price || it.product_id?.price || 0) * Number(it.quantity || 1)),
      0
    );

  const isVendorManagedDelivery = formData.logistics_company_id === VENDOR_MANAGED_LOGISTICS_ID;
  const defaultLogisticsOption = {
    _id: VENDOR_MANAGED_LOGISTICS_ID,
    company_name: 'Vendor-managed delivery',
    description: 'No logistics agency fee. The vendor arranges delivery directly.',
    user_id: { name: 'No agency fee', branding: {} },
    isDefaultVendorManaged: true,
  };
  const logisticsOptions = [defaultLogisticsOption, ...logisticsFirms];
  const selectedLogistics = isVendorManagedDelivery
    ? defaultLogisticsOption
    : logisticsFirms.find(f => f._id === formData.logistics_company_id);

  const getCheckoutVendorIds = () => {
    const items = order?.products || cartItems;
    let vendorIds = [...new Set(items.map(it => it.vendor_id?._id || it.vendor_id || it.product?.vendor_id).filter(Boolean))];
    if (vendorIds.length === 0 && order?.vendor_id) {
      vendorIds = [order.vendor_id?._id || order.vendor_id];
    }
    return vendorIds;
  };

  const getFirmZonePrice = (firm, quartier) => {
    const zoneName = normalizeZoneName(quartier);
    if (!firm || !zoneName) return 0;
    const selectedZone = zones.find((z) => getZoneName(z).toLowerCase() === zoneName.toLowerCase());
    const district = normalizeZoneName(selectedZone?.parent_id?.name);
    const match = firm.quartier_prices?.find((p) => {
      const pricedZone = normalizeZoneName(p.quartier).toLowerCase();
      return pricedZone === zoneName.toLowerCase() || (district && pricedZone === district.toLowerCase());
    });
    return Number(match?.price || 0);
  };

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

  const handleRemoveCheckoutItem = async (item) => {
    if (orderId) {
      toast.error('This order is already created. Remove items before checkout.');
      return;
    }

    const itemKey = item.cart_item_id || item.id || cartLineKey(item);
    setRemovingItemKey(itemKey);

    if (productId) {
      setCartItems([]);
      toast.success('Item removed from checkout.');
      router.push('/cart');
      return;
    }

    const previousItems = cartItems;
    setCartItems((current) => current.filter((entry) => (entry.cart_item_id || entry.id || cartLineKey(entry)) !== itemKey));
    cartStore.startMutation();

    try {
      const res = await api.delete('/cart/item', { data: { item_id: item.cart_item_id || item.id || item.product_id } });
      if (res.data?.success) {
        cartStore.setCart(res.data.data.cart);
        const nextItems = previousItems.filter((entry) => (entry.cart_item_id || entry.id || cartLineKey(entry)) !== itemKey);
        if (nextItems.length === 0) {
          toast.success('Cart is empty.');
          router.push('/cart');
        } else {
          toast.success('Item removed from checkout.');
        }
      } else {
        throw new Error(res.data?.message || 'Failed to remove item');
      }
    } catch (err) {
      setCartItems(previousItems);
      toast.error(err?.response?.data?.message || 'Could not remove item.');
    } finally {
      cartStore.endMutation();
      setRemovingItemKey(null);
    }
  };
  
  // 0. Fetch Zones
  useEffect(() => {
    api.get('/logistics/zones')
      .then(res => {
        if (res.data.success) {
          const quartiers = res.data.data.zones.filter(z => z.type === 'quartier') || [];
          setZones(quartiers);
        }
      })
      .catch(err => console.error("Error fetching zones:", err));
  }, []);

  // Fetch logistics firms. Empty zone shows verified partners; selected zone narrows to compatible firms.
  useEffect(() => {
    const items = order?.products || cartItems;
    if (!items.length) return;

    const vendorIds = getCheckoutVendorIds();
    if (vendorIds.length === 0) return;

    setLogisticsLoading(true);
    const params = new URLSearchParams({ vendor_ids: vendorIds.join(',') });
    if (deliveryQuartier) params.set('quartier', deliveryQuartier);
    api.get(`/logistics/compatible-firms?${params.toString()}`)
      .then(res => {
        if (res.data.success) {
           const firms = res.data.data.firms || [];
           setLogisticsFirms(firms);
           
           if (
              formData.logistics_company_id &&
              formData.logistics_company_id !== VENDOR_MANAGED_LOGISTICS_ID &&
              !firms.find(f => f._id === formData.logistics_company_id)
           ) {
              setFormData(prev => ({
                ...prev,
                logistics_company_id: VENDOR_MANAGED_LOGISTICS_ID,
              }));
           }
        }
      })
      .catch(err => toast.error("Logistics node lookup failed"))
      .finally(() => setLogisticsLoading(false));
  }, [deliveryQuartier, order, cartItems]);

  // Hydrate profile + saved address once per user (never overwrite a manually chosen zone)
  useEffect(() => {
    if (!user?._id || profileHydratedRef.current) return;
    profileHydratedRef.current = true;

    setFormData((f) => ({
      ...f,
      name: f.name || user.name || '',
      email: f.email || user.email || '',
      phone: f.phone || user.phone || '',
      city: f.city || user.onboarding_location?.city || '',
      address: f.address || user.onboarding_location?.address_description || '',
    }));

    if (!deliveryQuartierTouchedRef.current && !deliveryQuartier) {
      const initialQuartier = normalizeZoneName(user.onboarding_location?.quartier);
      if (initialQuartier) {
        setDeliveryQuartier(initialQuartier);
      }
    }

    if (refreshWalletBalance) {
      refreshWalletBalance().catch(() => {});
    }

    Promise.all([
      api.get('/users/me').catch(() => null),
      api.get('/addresses').catch(() => null),
    ]).then(([profileRes, addressRes]) => {
      const u = profileRes?.data?.success ? profileRes.data.data.user : null;
      const addrs = addressRes?.data?.success ? addressRes.data.data.addresses || [] : [];
      const def = addrs.find((a) => a.is_default) || addrs[0];

      if (u) {
        const freshBalance = Number(u.wallet_balance ?? 0);
        setSharedWalletBalance(freshBalance);
      }

      if (addrs.length) {
        setSavedAddresses(addrs);
      }

      setFormData((f) => ({
        ...f,
        name: f.name || def?.name || u?.name || user.name || '',
        email: f.email || u?.email || user.email || '',
        phone: f.phone || def?.phone || u?.phone || user.phone || '',
        city: f.city || def?.city || u?.onboarding_location?.city || user.onboarding_location?.city || '',
        address:
          f.address
          || def?.address_line
          || u?.onboarding_location?.address_description
          || user.onboarding_location?.address_description
          || '',
      }));

      if (!deliveryQuartierTouchedRef.current && !deliveryQuartier) {
        const fallbackQuartier = normalizeZoneName(
          def?.quartier || u?.onboarding_location?.quartier || user.onboarding_location?.quartier
        );
        if (fallbackQuartier) {
          setDeliveryQuartier(fallbackQuartier);
        }
      }
    });
  }, [user?._id]);

  // 3. Load Order Matrix or Cart Items
  useEffect(() => {
    if (orderId) {
      api.get(`/orders/${orderId}`)
        .then(res => { 
          if (res.data.success) {
            const loadedOrder = res.data.data.order;
            setOrder(loadedOrder);
            const orderQuartier = normalizeZoneName(loadedOrder?.shipping_address?.quartier);
            if (orderQuartier) {
              deliveryQuartierTouchedRef.current = true;
              setDeliveryQuartier(orderQuartier);
            }
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
              vendor_minimum_order_amount: p.vendor_id?.store?.minimum_order_amount ?? null,
              name: p.name,
              price: priced.price,
              compare_at_price: priced.compare_at_price,
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
                id: i._id,
                cart_item_id: i._id,
                product_id: i.product?._id || i.product,
                vendor_id: i.product?.vendor_id?._id || i.product?.vendor_id,
                vendor_name: i.product?.vendor_id?.store_name || i.product?.vendor_id?.user_id?.name || 'Aura Merchant Node',
                vendor_minimum_order_amount: i.product?.vendor_id?.store?.minimum_order_amount ?? null,
                name: i.product?.name,
                price: priced.price,
                compare_at_price: priced.compare_at_price,
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
    const currentCartItems = [...cartItems];
    const currentOrder = order;
    if ((currentOrder?.products || currentCartItems).length === 0) {
      toast.error('Your checkout has no items.');
      router.push('/cart');
      return;
    }

    // Compute amounts from the authoritative sources, not stale state
    const lineItems = currentOrder?.products || currentCartItems;
    const computedSubtotal = currentOrder?.subtotal > 0
      ? Number(currentOrder.subtotal)
      : sumLineItems(lineItems);
    const placeOrderVendorIds = getCheckoutVendorIds();
    const placeOrderPerVendorFee = !isVendorManagedDelivery && formData.logistics_company_id && deliveryQuartier && selectedLogistics
      ? getFirmZonePrice(selectedLogistics, deliveryQuartier)
      : 0;
    const computedDelivery = orderId && currentOrder?.shipping_fee != null
      ? Number(currentOrder.shipping_fee)
      : placeOrderPerVendorFee * placeOrderVendorIds.length;
    const computedOrderTotal = computedSubtotal + computedDelivery;

    const isPayOnDelivery = formData.paymentMethod === 'pay_on_delivery';
    const isEversend = formData.paymentMethod === 'eversend';
    const isPayUnit = formData.paymentMethod === 'payunit';
    const isExternal = isEversend || isPayUnit;
    const isWalletPayment = formData.paymentMethod === 'wallet';
    const computedCollectionFee = isExternal ? MOBILE_MONEY_COLLECTION_FEE_XAF : 0;
    const totalAmount = computedOrderTotal + computedCollectionFee;

    if (isWalletPayment && displayedWalletBalance < computedOrderTotal) {
      setBlockReason('insufficient_wallet');
      setError(`Your wallet balance (${displayedWalletBalance.toLocaleString()} XAF) is insufficient for this order (${computedOrderTotal.toLocaleString()} XAF).`);
      return;
    }
    if (isEversend && totalAmount < 500) {
      setError(`Eversend requires a minimum payment of 500 XAF. Your current total is ${totalAmount.toLocaleString()} XAF.`);
      toast.error('Minimum amount for Eversend is 500 XAF');
      return;
    }
    const minimumErrors = vendorMinimumErrors;
    if (minimumErrors.length > 0) {
      setMinimumWarningsDismissed(false);
      const first = minimumErrors[0];
      toast.error(`Your order from ${first.name} must be at least ${first.minimum.toLocaleString()} XAF.`);
      return;
    }

    if (!deliveryQuartier) {
      toast.error('Please select your delivery zone.');
      return;
    }

    if (!isVendorManagedDelivery && !formData.logistics_company_id) {
      toast.error('Please select a logistics partner or choose vendor-managed delivery.');
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
               quartier: deliveryQuartier,
               email: formData.email,
               phone: formData.phone
            },
            escrow_enabled: !isPayOnDelivery && formData.escrowEnabled,
            payment_method: isPayOnDelivery ? 'pay_on_delivery'
              : isPayUnit ? 'payunit'
              : isEversend ? 'eversend'
              : (formData.escrowEnabled ? 'escrow' : 'wallet'),
            shipping_method: isVendorManagedDelivery ? 'vendor_managed' : 'logistics_partner',
            logistics_company_id: isVendorManagedDelivery ? null : formData.logistics_company_id,
            delivery_quartier: deliveryQuartier
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

      if (!isExternal) {
        for (const id of finalOrderIds) {
          if (isPayOnDelivery) continue;
          if (formData.escrowEnabled) {
            await api.post('/escrow/hold', { order_id: id });
          } else {
            await api.post(`/orders/${id}/pay-direct`);
          }
        }
        if (!isPayOnDelivery) {
          if (isWalletPayment) {
            setSharedWalletBalance(Math.max(0, displayedWalletBalance - computedOrderTotal));
          }
          await refreshWalletBalance?.();
          window.dispatchEvent(new CustomEvent('aura:wallet-updated'));
        }
      } else if (isExternal) {
        const gateway = isPayUnit ? 'payunit' : 'eversend';
        const gatewayLabel = isPayUnit ? 'PayUnit' : 'Eversend';
        const gatewayFields = isPayUnit ? formData.payunit : formData.eversend;
        setEversendCheckout({
          active: true,
          reference: null,
          message: `Sending request to ${gatewayLabel}...`,
        });

        const evRes = await initiateCollection(gateway, {
           amount: totalAmount,
           currency: gatewayFields.currency || 'XAF',
           phone: gatewayFields.phone || formData.phone,
           country: gatewayFields.country || 'CM',
           provider: gatewayFields.provider,
           order_ids: finalOrderIds,
           redirect_url: `${window.location.origin}/wallet/verify?gateway=${gateway}&type=checkout`,
        });

        if (!evRes.success) {
          await markCreatedOrdersFailed(`${gatewayLabel} collection failed before payment completed.`, finalOrderIds);
          setBlockReason(displayedWalletBalance <= 0 ? 'collection_failed_no_wallet' : 'collection_failed');
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
            gateway,
            ref,
            {
              onPending: (data) => setEversendCheckout((current) => ({
                ...current,
                message: data.message || 'Awaiting mobile money confirmation...',
              })),
              onSuccess: () => {
                toast.success('Payment confirmed! Your order is being processed.');
                setCheckoutTotals({
                  subtotal: computedSubtotal,
                  finalDeliveryFee: computedDelivery,
                  totalAmount: computedOrderTotal + computedCollectionFee,
                  items: order?.products?.length ? [...(order.products)] : [...currentCartItems]
                });
                cartStore.clearCart();
                setEversendCheckout({ active: false, reference: null, message: '' });
                setStep(3);
              },
              onFailed: (data) => {
                markCreatedOrdersFailed(`${gatewayLabel} collection was declined before payment completed.`, finalOrderIds);
                setEversendCheckout({ active: false, reference: null, message: '' });
                setBlockReason(displayedWalletBalance <= 0 ? 'collection_failed_no_wallet' : 'collection_failed');
                setError(data.reason || 'Payment was declined by the gateway.');
              },
              onTimeout: () => {
                setEversendCheckout({ active: false, reference: null, message: '' });
                router.push(`/wallet/verify?gateway=${gateway}&type=checkout&ref=${ref}`);
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
      } else {
        toast.success(formData.paymentMethod === 'wallet' && formData.escrowEnabled ? 'Funds secured in Escrow Protocol.' : 'Direct payment completed successfully.');
      }

      setCheckoutTotals({
        subtotal: computedSubtotal,
        finalDeliveryFee: computedDelivery,
        totalAmount: computedOrderTotal + computedCollectionFee,
        items: order?.products?.length ? [...(order.products)] : [...currentCartItems]
      });
      cartStore.clearCart();
      setStep(3);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Checkout failed. Please try again.';
      setError(msg);
      setEversendCheckout({ active: false, reference: null, message: '' });
      toast.error(msg);
    } finally {
      setLoading(false);
    }

  };

  const matrixItems = (step === 3 && checkoutTotals) ? checkoutTotals.items : (order?.products || cartItems);
  const vendorIdsForSummary = getCheckoutVendorIds();
  const feePerVendor = selectedLogistics && !isVendorManagedDelivery && deliveryQuartier
    ? getFirmZonePrice(selectedLogistics, deliveryQuartier)
    : 0;

  const summary = useMemo(() => {
    const lineItems = order?.products || cartItems;
    const lineSubtotal = sumLineItems(lineItems);
    const subtotal = (step === 3 && checkoutTotals)
      ? checkoutTotals.subtotal
      : ((order?.subtotal > 0 ? Number(order.subtotal) : null) ?? lineSubtotal);

    let deliveryFee = 0;
    if (step === 3 && checkoutTotals) {
      deliveryFee = checkoutTotals.finalDeliveryFee;
    } else if (orderId && order?.shipping_fee != null) {
      deliveryFee = Number(order.shipping_fee);
    } else if (!isVendorManagedDelivery && formData.logistics_company_id && deliveryQuartier) {
      deliveryFee = feePerVendor * vendorIdsForSummary.length;
    }

    const collectionFee = isMobileMoneyPayment(formData.paymentMethod) ? MOBILE_MONEY_COLLECTION_FEE_XAF : 0;
    const totalAmount = (step === 3 && checkoutTotals)
      ? checkoutTotals.totalAmount
      : subtotal + deliveryFee + collectionFee;

    return { subtotal, deliveryFee, collectionFee, totalAmount };
  }, [
    step,
    checkoutTotals,
    order,
    cartItems,
    orderId,
    isVendorManagedDelivery,
    formData.logistics_company_id,
    formData.paymentMethod,
    deliveryQuartier,
    feePerVendor,
    vendorIdsForSummary.length,
  ]);

  const { subtotal, deliveryFee: finalDeliveryFee, collectionFee, totalAmount } = summary;
  const vendorMinimumErrors = useMemo(() => {
    const grouped = new Map();

    matrixItems.forEach((item) => {
      const vendorId = item.vendor_id?._id || item.vendor_id || item.product?.vendor_id?._id || item.product?.vendor_id;
      if (!vendorId) return;

      const existing = grouped.get(vendorId) || {
        id: vendorId,
        name: item.vendor_name || item.vendor_id?.store_name || item.product?.vendor_id?.store_name || 'Merchant Enterprise',
        subtotal: 0,
        minimum: null,
      };

      existing.subtotal += Number(item.price || item.product_id?.price || item.product?.price || 0) * Number(item.quantity || 1);
      const rawMinimum = item.vendor_minimum_order_amount ?? item.vendor_id?.store?.minimum_order_amount ?? item.product?.vendor_id?.store?.minimum_order_amount;
      const minimum = Number(rawMinimum);
      if (Number.isFinite(minimum) && minimum > 0) existing.minimum = minimum;
      grouped.set(vendorId, existing);
    });

    return Array.from(grouped.values()).filter((entry) => entry.minimum && entry.subtotal < entry.minimum);
  }, [matrixItems]);

  const checkoutBlocked = !deliveryQuartier || (!isVendorManagedDelivery && !formData.logistics_company_id) || vendorMinimumErrors.length > 0;

  const vendorTracking = matrixItems.reduce((acc, item) => {
     const vId = item.vendor_id?._id || item.vendor_id || item.product?.vendor_id;
     if (!acc[vId]) {
        acc[vId] = { 
           id: vId, 
           name: item.vendor_name || order?.vendor_id?.store_name || order?.vendor_id?.user_id?.name || 'Merchant Enterprise',
           fee: feePerVendor,
        };
     }
     return acc;
  }, {});

  const vendorList = Object.values(vendorTracking);

  const paymentOptions = [
    {
      id: 'payunit',
      label: 'PayUnit',
      badge: 'Primary',
      description: 'MTN Mobile Money and Orange Money via PayUnit.',
      icon: Smartphone,
    },
    {
      id: 'wallet',
      label: 'Aura Wallet',
      badge: `${displayedWalletBalance.toLocaleString()} XAF`,
      description: 'Pay from your Auradime wallet balance.',
      icon: CreditCard,
    },
    {
      id: 'eversend',
      label: 'Eversend',
      badge: '500 XAF min',
      description: 'Mobile money collection with a 500 XAF minimum.',
      icon: Smartphone,
    },
    {
      id: 'pay_on_delivery',
      label: 'Pay on Delivery',
      badge: 'Delivery',
      description: 'Settle payment when delivery is confirmed.',
      icon: Truck,
    },
  ];
  const selectedPayment = paymentOptions.find((option) => option.id === formData.paymentMethod) || paymentOptions[0];
  const SelectedPaymentIcon = selectedPayment.icon;

  const selectPaymentMethod = (method) => {
    setPaymentOpen(false);
    setFormData((current) => {
      if (method === 'payunit') {
        return {
          ...current,
          paymentMethod: 'payunit',
          payunit: { ...current.payunit, phone: current.payunit.phone || current.phone },
        };
      }
      if (method === 'eversend') {
        return {
          ...current,
          paymentMethod: 'eversend',
          eversend: { ...current.eversend, phone: current.eversend.phone || current.phone },
        };
      }
      if (method === 'pay_on_delivery') {
        return { ...current, escrowEnabled: false, paymentMethod: 'pay_on_delivery' };
      }
      return { ...current, paymentMethod: 'wallet' };
    });
  };

  return (
    <div className="checkout-page min-h-[100dvh] w-full bg-[var(--bg-secondary)] text-[var(--text-primary)] selection:bg-[var(--accent)]/30 overflow-x-hidden transition-colors duration-500 pb-16">
      <div className="fixed top-[-12%] right-[-12%] h-[420px] w-[420px] rounded-full bg-[var(--accent)]/5 blur-[120px] pointer-events-none -z-0"></div>
      
      <nav className="sticky top-0 z-[60] flex h-14 items-center justify-between border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 px-3 shadow-sm backdrop-blur-2xl sm:h-16 sm:px-6 lg:px-10">
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
                 <p className="text-sm  font-bold font-mono">{displayedWalletBalance.toLocaleString()} XAF</p>
              </div>
           </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto w-full max-w-none px-3 py-4 font-poppins sm:px-5 sm:py-6 lg:px-6 lg:py-7 xl:px-8 2xl:px-10">

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
                    onClick={handleTerminateCheckout}
                    className="w-full h-12 rounded-2xl border border-red-500/20 text-red-400  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-2 hover:bg-red-500/5 transition-all"
                  >
                    Cancel Order
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] xl:gap-7 2xl:grid-cols-[minmax(0,1fr)_minmax(390px,480px)]">
          <div className="min-w-0 space-y-5 lg:space-y-6">
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

            <div className="pt-4">
              {/* Existing Step 1 & 2 content ... */}
              {step === 1 && (
                <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                       <div className="flex size-11 items-center justify-center rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm sm:size-12"><MapPin className="size-5 sm:size-6" /></div>
                       <div>
                          <h2 className="text-xl font-bold tracking-tight leading-tight sm:text-2xl">Delivery Details</h2>
                          <p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)] sm:text-[12px]">Confirm your address, logistics partner, and payment method.</p>
                       </div>
                    </div>

                    <div className="glass-panel space-y-5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/70 p-4 sm:p-5 md:p-6">
                       <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                          <div className="space-y-2 md:space-y-3">
                            <label className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  ml-1">Consignee Name</label>
                            <input 
                              placeholder="Full Name"
                              value={formData.name}
                              onChange={e => setFormData(prev => ({...prev, name: e.target.value}))}
                              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[16px] font-semibold outline-none transition-all focus:border-[var(--accent)] md:text-[13px]"
                            />
                          </div>
                          <div className="space-y-2 md:space-y-3">
                            <label className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  ml-1">Comms Protocol (Phone)</label>
                            <input 
                              placeholder="+237 ..."
                              value={formData.phone}
                              onChange={e => setFormData(prev => ({...prev, phone: e.target.value}))}
                              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[16px] font-semibold outline-none transition-all focus:border-[var(--accent)] md:text-[13px]"
                            />
                          </div>
                          <div className="md:col-span-2 space-y-2 md:space-y-3">
                            <label className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  ml-1">Handshake Email</label>
                            <input 
                              type="email"
                              placeholder="email@example.com"
                              value={formData.email}
                              onChange={e => setFormData(prev => ({...prev, email: e.target.value}))}
                              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[16px] font-semibold outline-none transition-all focus:border-[var(--accent)] md:text-[13px]"
                            />
                          </div>
                          

                          <div className="md:col-span-2 space-y-3 md:space-y-4">
                            <label className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  ml-1">Delivery Quartier (Zone)</label>

                            <ZonePickerField
                              value={deliveryQuartier}
                              onChange={handleQuartierChange}
                              zones={zones}
                            />
                          </div>

                          <div className="md:col-span-2 space-y-2 md:space-y-3">
                            <label className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  ml-1">Precise Landing Details (Build/Street No.)</label>
                            <textarea 
                              placeholder="House number, color of gate, or specific landmarks..."
                              rows={3}
                              value={formData.address}
                              onChange={e => setFormData(prev => ({...prev, address: e.target.value}))}
                              className="w-full resize-none rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[16px] font-semibold outline-none transition-all focus:border-[var(--accent)] md:text-[13px]"
                            />
                          </div>

                       </div>

                       <div className="pt-4 space-y-4">
                          <label className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  ml-1">Delivery Option</label>
                          <div className="relative">
                             <button 
                                type="button"
                                onClick={() => setLogisticsOpen(!logisticsOpen)}
                                className={`flex w-full items-center justify-between rounded-xl border bg-[var(--bg-secondary)] px-4 py-3 text-left outline-none transition-all ${logisticsOpen ? 'border-[var(--accent)]' : 'border-[var(--glass-border)]'}`}
                             >
                                <div className="flex items-center gap-4 min-w-0">
                                   <div className="size-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0">
                                      {selectedLogistics?.isDefaultVendorManaged ? (
                                         <Truck className="size-5 text-[var(--accent)] opacity-80" />
                                      ) : formData.logistics_company_id && selectedLogistics ? (
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
                                             {selectedLogistics.isDefaultVendorManaged
                                                ? 'No logistics agency fee'
                                                : deliveryQuartier ? `Serves ${deliveryQuartier}` : 'Verified partner'}
                                          </p>
                                        </>
                                      ) : (
                                        <span className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-30">
                                          {deliveryQuartier ? 'Select delivery option' : 'Select zone or preview partners'}
                                        </span>
                                      )}
                                   </div>
                                </div>
                                <ChevronDown className={`size-4 opacity-40 transition-transform ${logisticsOpen ? 'rotate-180' : ''}`} />
                             </button>

                             <SearchableLogisticsDropdown 
                                firms={logisticsOptions}
                                selectedId={formData.logistics_company_id}
                                onSelect={(id) => setFormData(prev => ({...prev, logistics_company_id: id}))}
                                loading={logisticsLoading}
                                open={logisticsOpen}
                                onClose={() => setLogisticsOpen(false)}
                             />
                          </div>

                       </div>

                       <div className="pt-4 space-y-4">
                           <label className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  ml-1">Payment Strategy</label>
                           <div className="relative">
                              <button
                                type="button"
                                onClick={() => setPaymentOpen((open) => !open)}
                                className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all ${paymentOpen ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]'}`}
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--accent)]">
                                    <SelectedPaymentIcon className="size-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <p className="truncate text-[12px] font-semibold tracking-tight text-[var(--text-primary)]">{selectedPayment.label}</p>
                                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500">
                                        {selectedPayment.badge}
                                      </span>
                                    </div>
                                    <p className="mt-1 line-clamp-1 text-[10px] font-medium text-[var(--text-secondary)] sm:text-[11px]">{selectedPayment.description}</p>
                                  </div>
                                </div>
                                <ChevronDown className={`size-4 shrink-0 opacity-45 transition-transform ${paymentOpen ? 'rotate-180' : ''}`} />
                              </button>

                              <AnimatePresence>
                                {paymentOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.16 }}
                                    className="absolute left-0 right-0 top-full z-[120] mt-2 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-2xl"
                                  >
                                    {paymentOptions.map((option) => {
                                      const Icon = option.icon;
                                      const active = option.id === formData.paymentMethod;
                                      return (
                                        <button
                                          key={option.id}
                                          type="button"
                                          onClick={() => selectPaymentMethod(option.id)}
                                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-all hover:bg-[var(--accent)]/5 ${active ? 'bg-[var(--accent)]/10' : ''}`}
                                        >
                                          <div className={`flex size-10 shrink-0 items-center justify-center rounded-2xl border ${active ? 'border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
                                            <Icon className="size-4" />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <p className="truncate text-[11px] font-semibold text-[var(--text-primary)] sm:text-[12px]">{option.label}</p>
                                              <span className="shrink-0 rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                                {option.badge}
                                              </span>
                                            </div>
                                            <p className="mt-0.5 line-clamp-1 text-[10px] font-medium text-[var(--text-secondary)]">{option.description}</p>
                                          </div>
                                          {active && <CheckCircle2 className="size-4 shrink-0 text-[var(--accent)]" />}
                                        </button>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                           </div>

                           {formData.paymentMethod !== 'pay_on_delivery' && (
                              <div className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-4 transition-all hover:border-[var(--accent)]/30"
                                   onClick={() => setFormData(prev => ({...prev, escrowEnabled: !prev.escrowEnabled}))}>
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

                           {['payunit', 'eversend'].includes(formData.paymentMethod) && (
                              <div className="mt-4 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                       <label className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-60 ml-1">Collection Number</label>
                                       <input
                                          type="text"
                                          placeholder="+237..."
                                          value={formData.paymentMethod === 'payunit' ? formData.payunit.phone : formData.eversend.phone}
                                          onChange={e => {
                                            if (formData.paymentMethod === 'payunit') {
                                              setFormData(prev => ({...prev, payunit: {...prev.payunit, phone: e.target.value}}));
                                            } else {
                                              setFormData(prev => ({...prev, eversend: {...prev.eversend, phone: e.target.value}}));
                                            }
                                          }}
                                          className="h-12 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 text-[16px] font-semibold outline-none transition-all focus:border-[var(--accent)] md:text-[13px]"
                                       />
                                    </div>
                                    <div className="space-y-2">
                                       <label className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-60 ml-1">
                                          {formData.paymentMethod === 'payunit' ? 'Network' : 'Currency'}
                                       </label>
                                       {formData.paymentMethod === 'payunit' ? (
                                          <select
                                            value={formData.payunit.provider}
                                            onChange={(e) => setFormData(prev => ({...prev, payunit: {...prev.payunit, provider: e.target.value}}))}
                                            className="h-12 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 text-[16px] font-semibold outline-none transition-all focus:border-[var(--accent)] md:text-[13px]"
                                          >
                                            <option value="CM_MTNMOMO">MTN Mobile Money</option>
                                            <option value="CM_ORANGE">Orange Money</option>
                                          </select>
                                       ) : (
                                          <div className="flex h-12 w-full cursor-not-allowed select-none items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 text-[11px] font-semibold lg:text-[12px]">
                                             <span className="text-[var(--text-primary)]">XAF</span>
                                             <span className="text-[var(--text-secondary)] opacity-50">Central African Franc</span>
                                             <span className="ml-auto text-[10px] lg:text-[12px]  font-semibold tracking-widest bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-1 rounded-lg">LOCKED</span>
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>

                     <button 
                        onClick={() => setStep(2)}
                        disabled={loading || checkoutBlocked}
                        className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[var(--text-primary)] text-[10px] font-semibold tracking-[0.18em] text-[var(--bg-primary)] shadow-lg transition-all hover:bg-[var(--accent)] hover:text-white active:scale-95 disabled:opacity-20 lg:text-[12px]"
                      >
                        <>
                          REVIEW & CONFIRM
                          <ArrowRight className="size-4" />
                        </>
                      </button>
                  </div>
                </section>
              )}
              {step === 2 && (
                <section className="animate-in fade-in zoom-in-95 duration-700">
                   <div className="space-y-5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm sm:size-12"><CheckCircle2 className="size-6" /></div>
                        <div>
                          <h2 className="text-xl font-bold tracking-tight leading-tight sm:text-2xl">Review Order</h2>
                          <p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)] sm:text-[12px]">Check delivery, payment, and totals before placing the order.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                         <div className="space-y-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/70 p-4">
                            <p className="text-[11px] lg:text-[12px]  font-semibold  text-[var(--text-secondary)] tracking-tight mb-6 opacity-40">Authorized Consignee</p>
                            <p className="text-xl  font-bold text-[var(--text-primary)]">{formData.name}</p>
                            <p className="text-xs text-[var(--text-secondary)]  font-bold mb-2">{formData.email}</p>
                            <p className="text-sm  font-bold text-[var(--text-secondary)] flex items-start gap-2">
                               <MapPin className="size-4 shrink-0 mt-0.5 text-[var(--accent)]" />
                               <span>
                                 {deliveryQuartier && <span className="block text-[var(--text-primary)]">{deliveryQuartier}</span>}
                                 {formData.address || 'No street details provided'}
                               </span>
                            </p>
                         </div>
                         <div className="flex flex-col justify-between rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/70 p-4">
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
                                      <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] mb-1 opacity-60">Delivery Assigned</p>
                                      <p className="text-sm  font-bold text-[var(--text-primary)] tracking-tight truncate leading-none">
                                         {selectedLogistics.company_name}
                                      </p>
                                      <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] tracking-tight mt-1 opacity-80">
                                        {selectedLogistics.isDefaultVendorManaged ? 'No agency fee' : 'Verified AURA Node'}
                                      </p>
                                   </div>
                                </div>
                            )}

                      </div>
                      </div>

                      <div className={`${formData.escrowEnabled && formData.paymentMethod !== 'pay_on_delivery' ? 'bg-amber-500/5 border-amber-500/10' : 'bg-emerald-500/5 border-emerald-500/10'} relative flex items-start gap-4 overflow-hidden rounded-2xl border p-4`}>
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
                      <h2 className="text-5xl font-bold tracking-tighter mb-4 text-[var(--text-primary)]">Order <span className="text-[var(--accent)]">Successful</span></h2>
                      <p className="text-sm font-medium text-[var(--text-secondary)]">Your order has been placed and is being prepared for delivery.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <Link 
                        href="/orders"
                        className="w-full h-16 rounded-3xl bg-[var(--text-primary)] text-[var(--bg-primary)] font-semibold text-[10px] lg:text-[12px] tracking-tight flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] transition-all"
                      >
                         <Package className="size-4" /> Go to My Orders
                      </Link>
                      <Link 
                        href="/shop"
                        className="w-full h-16 rounded-3xl glass-panel border border-[var(--glass-border)] text-[var(--text-primary)] font-semibold text-[10px] lg:text-[12px] tracking-tight flex items-center justify-center gap-3 hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-all"
                      >
                         Continue Exploring <ArrowRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>

          <div className="h-fit min-w-0 xl:sticky xl:top-20">
            <div className="glass-panel relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/85 p-4 font-poppins shadow-sm backdrop-blur-2xl sm:p-5">
               <div className="mb-4 flex items-center justify-between gap-3">
                 <div>
                   <h3 className="text-base font-bold tracking-tight leading-none text-[var(--text-primary)] lg:text-lg">Order Summary</h3>
                   <p className="mt-1 text-[10px] font-semibold text-[var(--text-secondary)] opacity-55">{matrixItems.length} item{matrixItems.length === 1 ? '' : 's'}</p>
                 </div>
                 {!orderId && matrixItems.length > 0 && (
                   <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
                     Editable
                   </span>
                 )}
               </div>
               <div className="mb-5 max-h-[260px] space-y-3 overflow-y-auto pr-2 no-scrollbar">
                  {matrixItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)] p-5 text-center">
                      <p className="text-[12px] font-semibold text-[var(--text-secondary)]">No items in checkout</p>
                    </div>
                  ) : matrixItems.map((item, idx) => {
                    const itemKey = item.cart_item_id || item.id || cartLineKey(item) || idx;
                    const variantLabel = formatVariantLabel(item.variant);
                    const itemName = item.name || item.product?.name || item.product_id?.name || 'Product';
                    const itemImage = item.image || item.product?.images?.[0]?.url || item.product?.images?.[0] || item.product_id?.images?.[0]?.url || item.product_id?.images?.[0] || '/placeholder.png';
                    const canRemove = !orderId;
                    const hasSale = item.compare_at_price && Number(item.compare_at_price) > Number(item.price);
                    return (
                      <div key={itemKey} className="group flex items-start gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/55 p-2.5">
                         <img src={itemImage} className="size-12 rounded-2xl object-cover border border-[var(--glass-border)]" alt="" />
                         <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[12px] font-bold leading-snug text-[var(--text-primary)]">{itemName}</p>
                            {variantLabel && (
                              <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-snug text-[var(--accent)]/85">
                                {variantLabel}
                              </p>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-[var(--text-secondary)]">
                               <span className={hasSale ? 'text-[var(--accent)] font-bold' : ''}>
                                 {Number(item.price || 0).toLocaleString()} XAF
                               </span>
                               {hasSale && (
                                 <>
                                   <span className="line-through opacity-55">{Number(item.compare_at_price).toLocaleString()} XAF</span>
                                   <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-500">SALE</span>
                                 </>
                               )}
                               <span className="opacity-35">x</span>
                               <span>{item.quantity || 1}</span>
                             </div>
                         </div>
                         {canRemove && (
                           <button
                             type="button"
                             onClick={() => handleRemoveCheckoutItem(item)}
                             disabled={removingItemKey === itemKey}
                             className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] transition-all hover:border-red-500/30 hover:text-red-500 disabled:opacity-40"
                             aria-label={`Remove ${itemName}`}
                           >
                             {removingItemKey === itemKey ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                           </button>
                         )}
                      </div>
                    );
                  })}
               </div>
               

                {step === 2 && vendorMinimumErrors.length > 0 && !minimumWarningsDismissed && (
                  <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <div className="min-w-0 flex-1 space-y-2">
                        {vendorMinimumErrors.map((entry) => (
                          <p key={entry.id} className="text-[11px] font-semibold leading-snug">
                            Your order from {entry.name} must be at least {entry.minimum.toLocaleString()} XAF. Please add more items from this store or remove their products to continue.
                          </p>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setMinimumWarningsDismissed(true)}
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 text-amber-700 transition hover:bg-amber-500/10 dark:text-amber-300"
                        aria-label="Dismiss minimum order warning"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}
               <div className="space-y-4 py-5 border-t border-[var(--glass-border)]">
                   <div className="flex justify-between items-center text-[11px] font-semibold text-[var(--text-secondary)] lg:text-[12px]">
                      <span className="opacity-55">Cart Subtotal</span>
                      <span className="font-mono text-[12px] text-[var(--text-primary)]">{subtotal.toLocaleString()} XAF</span>
                   </div>
                   
                   {(finalDeliveryFee > 0 || (!isVendorManagedDelivery && deliveryQuartier && vendorList.length > 0)) && (
                      <div className="space-y-3 pt-3 border-t border-[var(--glass-border)]/20 animate-in fade-in duration-500">
                         <div className="flex items-center justify-between mb-2">
                           <p className="text-[11px] lg:text-[12px]  font-semibold  text-[var(--accent)] tracking-tight flex items-center gap-2">
                             <Truck className="size-3" /> Delivery Fees
                           </p>
                           <p className="text-[11px] lg:text-[12px] font-mono  font-semibold text-[var(--accent)]">{finalDeliveryFee.toLocaleString()} XAF</p>
                         </div>
                         {!orderId && vendorList.map((v, i) => (
                             <div key={i} className="flex justify-between items-center opacity-70">
                               <p className="text-[11px] lg:text-[12px]  font-semibold  text-[var(--text-secondary)]">
                                 From {v.name}
                               </p>
                               <p className="text-[10px] lg:text-[12px] font-mono">+{v.fee.toLocaleString()} XAF</p>
                             </div>
                           ))}
                      </div>
                   )}

                   {collectionFee > 0 && (
                      <div className="space-y-2 pt-3 border-t border-[var(--glass-border)]/20">
                         <div className="flex items-center justify-between">
                           <p className="text-[11px] lg:text-[12px]  font-semibold  text-[var(--text-secondary)] opacity-55 tracking-tight flex items-center gap-2">
                             Mobile Money Fee
                           </p>
                           <p className="text-[11px] lg:text-[12px] font-mono  font-semibold text-[var(--text-secondary)]">{collectionFee.toLocaleString()} XAF</p>
                         </div>
                      </div>
                   )}

                   <div className="flex justify-between items-end pt-4 border-t border-[var(--glass-border)]/50">
                      <div>
                         <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)] lg:text-[11px]">Final Total</p>
                         <p className="font-mono text-2xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums sm:text-3xl">{totalAmount.toLocaleString()}</p>
                      </div>
                      <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40  pb-2">XAF</p>
                   </div>
                </div>

                {step === 2 && (
                 <div className="space-y-6">
                   <button 
                     onClick={handlePlaceOrder}
                     disabled={loading || checkoutBlocked}
                     className={`flex h-14 w-full items-center justify-center gap-3 rounded-2xl text-[11px] font-semibold tracking-[0.18em] shadow-lg transition-all duration-500 group lg:text-[12px] ${
                        checkoutBlocked 
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ZonePickerField({ value, onChange, zones }) {
  const [displayZone, setDisplayZone] = useState('');
  const [zoneOpen, setZoneOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const pickerRef = useRef(null);
  const userPickedRef = useRef(false);

  useEffect(() => {
    try {
      const saved = normalizeZoneName(sessionStorage.getItem(CHECKOUT_QUARTIER_KEY) || '');
      if (saved && !userPickedRef.current) {
        setDisplayZone(saved);
        onChange(saved);
      } else if (value) {
        setDisplayZone(value);
      }
    } catch {
      if (value) setDisplayZone(value);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (userPickedRef.current) return;
    if (value) setDisplayZone(value);
  }, [value]);

  useEffect(() => {
    if (!zoneOpen) return undefined;

    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setZoneOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setZoneOpen(false);
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [zoneOpen]);

  const pickZone = (zoneName) => {
    const normalized = getZoneName({ name: zoneName });
    if (!normalized) return;
    userPickedRef.current = true;
    flushSync(() => {
      setDisplayZone(normalized);
      setZoneOpen(false);
    });
    try {
      sessionStorage.setItem(CHECKOUT_QUARTIER_KEY, normalized);
    } catch {}
    onChange(normalized);
  };

  const label = ready ? (displayZone || 'Search and select your zone') : 'Search and select your zone';

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setZoneOpen((open) => !open);
        }}
        aria-expanded={zoneOpen}
        aria-haspopup="listbox"
        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left outline-none transition-all ${
          zoneOpen
            ? 'border-[var(--accent)] bg-[var(--accent)]/5'
            : displayZone
              ? 'border-[var(--accent)]/25 bg-[var(--accent)]/8 hover:border-[var(--accent)]/40'
              : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/30'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
            displayZone ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'bg-[var(--bg-primary)] text-[var(--accent)] opacity-40'
          }`}>
            {displayZone ? <CheckCircle2 className="size-5" /> : <MapPin className="size-5" />}
          </div>
          <p
            key={displayZone || 'empty'}
            suppressHydrationWarning
            className={`min-w-0 flex-1 break-words text-sm font-bold ${
              displayZone ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)] opacity-50'
            }`}
          >
            {label}
          </p>
        </div>
        <ChevronDown className={`size-5 shrink-0 text-[var(--accent)] opacity-60 transition-transform ${zoneOpen ? 'rotate-180' : ''}`} />
      </button>

      <SearchableZoneDropdown
        open={zoneOpen}
        selected={displayZone}
        onSelect={pickZone}
        onClose={() => setZoneOpen(false)}
        zones={zones}
      />
    </div>
  );
}

function SearchableZoneDropdown({ open, selected, onSelect, onClose, zones }) {
  const [query, setQuery] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);
  
  if (!open) return null;

  const filtered = (zones || []).filter((z) => 
    getZoneName(z).toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (zone) => {
    const zoneName = getZoneName(zone);
    if (!zoneName) return;
    onSelect(zoneName);
    setQuery('');
  };

  return (
    <div
      role="listbox"
      aria-label="Delivery zones"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute left-0 top-full z-[110] mt-2 w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-2.5">
         {selected ? (
           <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] opacity-60">
             Switch from <span className="text-[var(--accent)]">{selected}</span>
           </p>
         ) : null}
         <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3 opacity-20 group-focus-within:text-[var(--accent)] transition-all" />
            <input
               ref={searchInputRef}
               placeholder={selected ? 'Search another zone...' : 'Search Quartier...'}
               value={query}
               onChange={e => setQuery(e.target.value)}
               className="w-full bg-transparent pl-10 pr-4 py-2 text-[16px] font-semibold tracking-tight outline-none placeholder:text-[16px]"
            />
         </div>
      </div>
      <div className="max-h-56 overflow-y-auto no-scrollbar">
         {filtered.length === 0 ? (
            <div className="p-8 text-center opacity-30">
               <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight">No zones found</p>
            </div>
         ) : (
            filtered.map((z) => {
              const zoneName = getZoneName(z);
              const isSelected = normalizeZoneName(selected).toLowerCase() === zoneName.toLowerCase();
              return (
               <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  key={z._id || zoneName}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(z);
                  }}
                  className={`w-full p-4 flex items-center gap-4 transition-all text-left ${
                    isSelected
                      ? 'bg-[var(--accent)]/10 hover:bg-[var(--accent)]/15'
                      : 'hover:bg-[var(--accent)]/5'
                  }`}
               >
                  <MapPin className="size-4 opacity-20 text-[var(--accent)]" />
                  <div className="min-w-0 flex-1">
                     <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight truncate">{zoneName}</p>
                     {isSelected ? (
                       <p className="mt-0.5 text-[10px] font-medium text-[var(--accent)]">Current zone</p>
                     ) : null}
                  </div>
                  {isSelected ? <CheckCircle2 className="size-4 text-[var(--accent)]" /> : null}
               </button>
              );
            })
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
    f.description?.toLowerCase().includes(query.toLowerCase()) ||
    f.user_id?.name?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="absolute left-0 top-full z-[100] mt-2 w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-2.5">
         <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3 opacity-20 group-focus-within:text-[var(--accent)] transition-all" />
            <input 
               placeholder="Search Logistics Node..."
               value={query}
               onChange={e => setQuery(e.target.value)}
               className="w-full bg-transparent pl-10 pr-4 py-2 text-[16px] font-semibold tracking-tight outline-none placeholder:text-[16px]"
            />
         </div>
      </div>
      <div className="max-h-60 overflow-y-auto no-scrollbar">
         {filtered.length === 0 ? (
            <div className="p-8 text-center opacity-30">
               <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight">
                  {loading ? 'Finding logistics nodes...' : 'No nodes found'}
               </p>
            </div>
         ) : (
            filtered.map(f => (
               <button
                  type="button"
                  key={f._id}
                  onClick={() => { onSelect(f._id); onClose(); }}
                  className={`w-full p-4 flex items-center gap-4 hover:bg-[var(--accent)]/5 transition-all text-left ${selectedId === f._id ? 'bg-[var(--accent)]/10' : ''}`}
               >
                  <div className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0">
                     {f.isDefaultVendorManaged ? (
                        <Truck className="size-5 text-[var(--accent)] opacity-80" />
                     ) : f.user_id?.branding?.logo || f.user_id?.avatar ? (
                        <img src={f.user_id?.branding?.logo || f.user_id?.avatar} className="size-full object-cover" alt="" />
                     ) : (
                        <Truck className="size-5 opacity-20" />
                     )}
                  </div>
                  <div className="min-w-0 flex-1">
                     <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight truncate">{f.company_name}</p>
                     <p className="text-[11px] lg:text-[12px]  font-semibold  text-[var(--text-secondary)] opacity-60 truncate">
                        {f.description || f.user_id?.name || 'Authorized Lead'}
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
    <Suspense fallback={null}>
      <CheckoutContent />
    </Suspense>
  );
}

