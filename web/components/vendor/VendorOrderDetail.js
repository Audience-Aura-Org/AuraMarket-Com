"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw, Package, CreditCard, Truck, Send, Download } from 'lucide-react';
import api from '@/services/api';
import socketService from '@/services/socket';
import StatCard from '@/components/layout/StatCard';
import workspace from '@/components/layout/Workspace.module.css';
import styles from './VendorOrderDetail.module.css';
import { formatVariantLabel } from '@/utils/variants';

const label = value => String(value || 'Pending').replace(/_/g, ' ');
const money = value => Number(value || 0).toLocaleString() + ' XAF';
const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString() : 'Not recorded';

export default function VendorOrderDetail({ orderId, onBack }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [messages, setMessages] = useState([]), [text, setText] = useState(''), [messageError, setMessageError] = useState('');
  const version = useRef(0);
  const activeOrder = useRef(orderId); activeOrder.current = orderId;
  const load = useCallback(async () => {
    const current = ++version.current;
    try {
      const response = await api.get(`/orders/${orderId}`, { skipClientCache: true });
      if (current === version.current) { setData(response.data.data); setError(''); }
    } catch (failure) { if (current === version.current) setError(failure.response?.data?.message || 'This order could not be loaded. Please retry.'); }
    finally { if (current === version.current) setLoading(false); }
  }, [orderId]);
  const loadMessages = useCallback(async () => {
    try { const response = await api.get(`/messages/order/${orderId}`, { skipClientCache: true }); if (activeOrder.current === orderId) { setMessages(response.data.data?.messages || []); setMessageError(''); if (document.visibilityState === 'visible') api.patch(`/messages/order/${orderId}/read`).catch(() => {}); } }
    catch { if (activeOrder.current === orderId) setMessageError('Messages could not be loaded. Use Refresh to try again.'); }
  }, [orderId]);
  useEffect(() => { setData(null); setMessages([]); setText(''); setLoading(true); load(); loadMessages(); return () => { version.current += 1; }; }, [load, loadMessages]);
  useEffect(() => {
    const refresh = () => { load(); loadMessages(); };
    socketService.on('order_update', refresh); socketService.on('shipment_updated', refresh); socketService.on('notification', refresh);
    window.addEventListener('aura:push-received', refresh);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(onVisible, 15000);
    return () => { socketService.off('order_update', refresh); socketService.off('shipment_updated', refresh); socketService.off('notification', refresh); window.removeEventListener('aura:push-received', refresh); document.removeEventListener('visibilitychange', onVisible); clearInterval(timer); };
  }, [load, loadMessages]);
  const update = async (status, food = false) => {
    if (busy) return; setBusy(true); setError('');
    try { await api.patch(`/orders/${orderId}/${food ? 'food-status' : 'status'}`, food ? { food_status: status } : { order_status: status }); await load(); }
    catch (failure) { await load(); setError(failure.response?.data?.message || 'The order could not be updated. Please retry.'); }
    finally { setBusy(false); }
  };
  const confirmDelivery = async () => {
    if (busy) return; setBusy(true);
    try { await api.post(`/escrow/confirm-delivery/${orderId}`); await load(); }
    catch (failure) { setError(failure.response?.data?.message || 'Delivery confirmation could not be saved.'); }
    finally { setBusy(false); }
  };
  const sendMessage = async event => {
    event.preventDefault(); if (busy || !text.trim()) return; setBusy(true); setMessageError('');
    try { await api.post(`/messages/order/${orderId}`, { text: text.trim() }); setText(''); await loadMessages(); }
    catch (failure) { setMessageError(failure.response?.data?.message || 'Message was not sent. Your draft is saved below.'); }
    finally { setBusy(false); }
  };
  const download = async () => {
    try { const response = await api.get(`/orders/${orderId}/invoice`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = `invoice-${orderId}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
    catch { setError('Invoice could not be downloaded. Please try again.'); }
  };
  const order = data?.order, shipment = data?.shipments?.[0], escrow = data?.escrow;
  const closed = !order || ['completed', 'delivered', 'cancelled', 'refunded', 'refund_pending', 'failed'].includes(order.order_status);
  const canWork = order?.payment_status === 'paid' || order?.payment_method === 'pay_on_delivery';
  let next = null;
  if (!closed && canWork) {
    const readyLog = [...(order.status_logs || [])].reverse().find(log => log.status === 'ready');
    const overduePickup = order.food_status === 'ready' && readyLog?.timestamp && Date.now() - new Date(readyLog.timestamp).getTime() >= 15 * 60000;
    if (order.food_status) next = { pending_acceptance: 'preparing', preparing: 'ready', ready: order.shipping_method === 'vendor_managed' || order.fulfilment_type !== 'delivery' || overduePickup ? 'picked_up' : null, picked_up: 'delivered' }[order.food_status];
    else next = { placed: 'processing', processing: order.shipping_method !== 'logistics_partner' ? 'shipped' : null, shipped: order.shipping_method !== 'logistics_partner' ? 'delivered' : null }[order.order_status];
  }
  const logs = [...(order?.status_logs || [])].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  return <div className={workspace.page}><div className={workspace.container}>
    <header className={workspace.header}><div className={workspace.heading}><button type="button" className={workspace.button} onClick={onBack}><ArrowLeft /> Orders</button><div><h1 className={workspace.title}>Order #{orderId.slice(-8).toUpperCase()}</h1><p className={workspace.subtitle}>{order ? date(order.createdAt) : 'Order details'}</p></div></div><div className={workspace.actions}><button type="button" className={workspace.button} onClick={() => { setMessageError(''); load(); loadMessages(); }}><RefreshCw /> Refresh</button><button type="button" className={workspace.button} onClick={download} disabled={!order}><Download /> Invoice</button></div></header>
    {error && <p role="alert" className={workspace.error}>{error}</p>}
    {loading ? <div className={workspace.empty} role="status">Loading order...</div> : !order ? <div className={workspace.empty}>Order unavailable. Use Refresh to try again.</div> : <>
      <div className={workspace.stats}><StatCard label="Order total" value={money(order.total_amount)} icon={CreditCard} color="primary" sub={label(order.payment_status)} footer={label(order.payment_method)} /><StatCard label="Fulfilment" value={label(order.food_status || order.order_status)} icon={Package} color="blue" sub={label(order.shipping_method)} footer={shipment?.tracking_code || 'No carrier tracking yet'} /><StatCard label="Escrow" value={escrow ? money(escrow.amount) : 'Not held'} icon={Truck} color="emerald" sub={escrow ? label(escrow.status) : 'Payment follows the order terms'} footer={escrow?.auto_release_at ? 'Release scheduled ' + date(escrow.auto_release_at) : 'Balance updates after settlement'} /></div>
      <div className={styles.layout}><div className={styles.main}>
        <section className={styles.panel}><div className={styles.head}><h2>Order items</h2><span className={workspace.category}>{order.products?.length || 0} items</span></div><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th scope="col">Product</th><th scope="col">Quantity</th><th scope="col">Price</th><th scope="col">Total</th></tr></thead><tbody>{(order.products || []).map((item,index) => <tr key={item._id || index}><td><div className={styles.product}>{(item.image || item.product_id?.images?.[0]) && <img alt="" src={item.image || item.product_id.images[0]} />}<div>{item.name || item.product_id?.name || 'Product'}<p className={styles.muted}>{formatVariantLabel(item.variant)}</p></div></div></td><td>{item.quantity || 1}</td><td>{money(item.price)}</td><td>{money(Number(item.price || 0) * Number(item.quantity || 1))}</td></tr>)}</tbody></table></div></section>
        <section className={styles.panel}><div className={styles.head}><h2>Order conversation</h2><span className={workspace.category}>Buyer, seller and assigned carrier</span></div><div className={styles.body}>
          {messageError && <p role="alert" className={workspace.error}>{messageError}</p>}<div className={styles.messages}>{messages.length ? messages.map(message => <div className={styles.message} key={message._id}><strong>{message.sender_name || 'Account'}</strong><time>{date(message.timestamp || message.createdAt)}</time><p>{message.text}</p></div>) : <p className={styles.muted}>No messages yet. Keep order updates together here.</p>}</div>
          <form className={styles.form} onSubmit={sendMessage}><textarea aria-label="Order message" value={text} onChange={event => setText(event.target.value)} maxLength={2000} placeholder="Message the order participants" /><button type="submit" className={workspace.button} disabled={busy || !text.trim()}><Send /> Send</button></form>
        </div></section>
        <section className={styles.panel}><div className={styles.head}><h2>Order activity</h2></div><div className={styles.body}><ol className={styles.timeline}>{logs.length ? logs.map((log,index) => <li key={log._id || index}><p>{label(log.status)}</p><time>{date(log.timestamp)}</time>{log.note && <p className={styles.muted}>{log.note}</p>}</li>) : <li><p>Order placed</p><time>{date(order.createdAt)}</time></li>}</ol></div></section>
      </div><aside className={styles.aside}>
        <section className={styles.panel}><div className={styles.head}><h2>Next step</h2></div><div className={styles.body}><p className={styles.muted}>{closed ? 'This order is closed or awaiting dispute resolution.' : !canWork ? 'Waiting for confirmed payment.' : next ? 'Update the order when this step is complete. Participants receive a notification.' : 'Waiting for the assigned carrier or buyer.'}</p><div className={workspace.actions} style={{marginTop:14}}>{escrow && ['held','pending_release'].includes(escrow.status) && ['delivered','completed'].includes(order.order_status) && <button type="button" className={workspace.button} disabled={busy} onClick={confirmDelivery}>Request buyer confirmation</button>}{next && <button type="button" className={workspace.button} disabled={busy} onClick={() => update(next, Boolean(order.food_status))}>{order.food_status === 'pending_acceptance' ? 'Accept order' : 'Mark ' + label(next)}</button>}{!closed && order.food_status === 'pending_acceptance' && canWork && <button type="button" className={workspace.button} disabled={busy} onClick={() => { if (window.confirm('Decline this order and refund its payment?')) update('rejected', true); }}>Decline order</button>}</div></div></section>
        <section className={styles.panel}><div className={styles.head}><h2>Customer</h2></div><div className={styles.body}><p>{order.customer_id?.name || 'Customer'}</p><p className={styles.muted}>{order.customer_id?.phone || order.shipping_address?.phone || 'No phone recorded'}</p><p className={styles.muted}>{order.customer_id?.email}</p></div></section>
        <section className={styles.panel}><div className={styles.head}><h2>Delivery</h2></div><div className={styles.body}><p>{order.shipping_address?.name}</p><p className={styles.muted}>{[order.shipping_address?.address_description || order.shipping_address?.street, order.shipping_address?.quartier, order.shipping_address?.city].filter(Boolean).join(', ') || label(order.fulfilment_type || order.shipping_method)}</p><p>{order.logistics_company_id?.company_name || 'Seller managed'}</p>{shipment && <p className={styles.muted}>{shipment.tracking_code} / {label(shipment.status)}</p>}</div></section>
      </aside></div>
    </>}
  </div></div>;
}
