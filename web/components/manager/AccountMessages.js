'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessagesSquare, RefreshCw, Send, Search } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import socketService from '@/services/socket';
import styles from './AccountMessages.module.css';

const TABS = [{ id: 'direct', label: 'Messages' }, { id: 'order', label: 'Order chats' }, { id: 'shipment', label: 'Delivery chats' }];
const identity = value => String(value?._id || value || '');
const date = value => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '';
const threadPath = (kind, id) => kind === 'direct' ? `/chat/${id}` : `/messages/${kind}/${id}`;

export default function AccountMessages() {
  const user = useAuthStore(state => state.user);
  const accountId = identity(user);
  const [kind, setKind] = useState('direct'), [threads, setThreads] = useState([]), [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]), [query, setQuery] = useState(''), [drafts, setDrafts] = useState({});
  const [error, setError] = useState(''), [threadError, setThreadError] = useState(''), [loading, setLoading] = useState(true), [loadingThread, setLoadingThread] = useState(false), [sending, setSending] = useState(false);
  const [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const openedIntent = useRef(null);
  const listVersion = useRef(0), selectedKey = useRef(''), sendingRef = useRef(false), clientIds = useRef({});
  const currentKey = selected ? accountId + ':' + kind + ':' + selected.id : '';
  selectedKey.current = currentKey;
  const config = useCallback(() => ({ headers: { 'X-Act-As': accountId }, __noActAs: true, skipClientCache: true }), [accountId]);
  const loadInbox = useCallback(async () => {
    const version = ++listVersion.current;
    try {
      const path = kind === 'direct' ? '/chat' : `/messages/${kind}-threads/mine`;
      const response = await api.get(path, config());
      if (version !== listVersion.current) return;
      const data = response.data.data;
      const rows = kind === 'direct' ? (data?.activeChats || []).map(chat => ({ id: identity(chat.partner), name: chat.partnerName || chat.partner?.name || 'Conversation', preview: chat.snippet, unread: chat.unread_count })) : (data?.threads || []).map(thread => {
        const record = thread[kind];
        return { id: identity(record), name: kind === 'order' ? 'Order #' + identity(record).slice(-8).toUpperCase() : record.tracking_code || 'Delivery', preview: thread.lastMessage?.text || 'Open conversation', unread: thread.unreadCount };
      });
      setThreads(rows); setError('');
    } catch (failure) { if (version === listVersion.current) setError(failure.response?.data?.message || 'Messages could not be loaded. Please retry.'); }
    finally { if (version === listVersion.current) setLoading(false); }
  }, [kind, config]);
  const loadThread = useCallback(async (olderPage = 1) => {
    if (!selected) return;
    const key = accountId + ':' + kind + ':' + selected.id;
    try {
      const response = await api.get(threadPath(kind, selected.id), { ...config(), params: { page: olderPage, limit: 20 } });
      if (key !== selectedKey.current) return;
      const incoming = response.data.data?.messages || [];
      setMessages(previous => [...new Map([...previous, ...incoming].map(message => [identity(message), message])).values()].sort((a,b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp)));
      if (kind === 'direct') { setTotal(response.data.data?.total || 0); setPage(previous => Math.max(previous, olderPage)); }
      setThreadError('');
      if (document.visibilityState === 'visible') {
        const readPath = kind === 'direct' ? `/chat/read/${selected.id}` : threadPath(kind, selected.id) + '/read';
        api.patch(readPath, {}, config()).then(() => setThreads(previous => selectedKey.current === key ? previous.map(thread => thread.id === selected.id ? {...thread, unread: 0} : thread) : previous)).catch(() => {});
      }
    } catch (failure) { if (key === selectedKey.current) setThreadError(failure.response?.data?.message || 'Conversation could not be loaded. Please retry.'); }
    finally { if (key === selectedKey.current) setLoadingThread(false); }
  }, [selected, kind, config, accountId]);
  useEffect(() => { setThreads([]); setLoading(true); loadInbox(); return () => { listVersion.current += 1; }; }, [loadInbox]);
  useEffect(() => { setMessages([]); setPage(1); setTotal(0); setThreadError(''); if (selected) { setLoadingThread(true); loadThread(); } }, [loadThread, selected]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') { loadInbox(); loadThread(); } };
    const timer = setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh); window.addEventListener('aura:push-received', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('aura:push-received', refresh); };
  }, [loadInbox, loadThread]);
  useEffect(() => {
    const publish = () => socketService.emit('chat_view', { accountId,
      partnerId: kind === 'direct' ? selected?.id : null,
      visible: document.visibilityState === 'visible' && kind === 'direct' && Boolean(selected),
    });
    const refresh = payload => {
      if (String(payload?.accountId) !== accountId) return;
      loadInbox();
      if (selected?.id === String(payload.senderId)) loadThread();
    };
    publish();
    const timer = setInterval(publish, 10000);
    socketService.on('managed_message', refresh);
    socketService.on('connect', publish);
    document.addEventListener('visibilitychange', publish);
    const ownMessage = message => {
      if ([identity(message?.sender_id), identity(message?.receiver_id)].includes(accountId)) { loadInbox(); if (selected) loadThread(); }
    };
    socketService.on('receive_message', ownMessage);
    return () => { clearInterval(timer); socketService.off('managed_message', refresh); socketService.off('receive_message', ownMessage); socketService.off('connect', publish); document.removeEventListener('visibilitychange', publish); socketService.emit('chat_view', { visible: false }); };
  }, [accountId, kind, selected, loadInbox, loadThread]);
  useEffect(() => { setSelected(null); setMessages([]); }, [accountId]);
  useEffect(() => {
    const partnerId = new URLSearchParams(window.location.search).get('partnerId');
    const intentKey = accountId + ':' + partnerId;
    if (partnerId && kind === 'direct' && !selected && openedIntent.current !== intentKey) {
      const thread = threads.find(row => row.id === partnerId);
      if (thread) { openedIntent.current = intentKey; setSelected(thread); }
    }
  }, [threads, kind, accountId, selected]);
  const send = async event => {
    event.preventDefault(); const text = (drafts[currentKey] || '').trim();
    if (!selected || !text || sendingRef.current) return;
    const key = currentKey; sendingRef.current = true; setSending(true); setThreadError('');
    try {
      const body = { text };
      if (kind === 'direct') {
        body.receiver_id = selected.id;
        if (clientIds.current[key]?.text !== text) clientIds.current[key] = { text, id: crypto.randomUUID() };
        body.client_id = clientIds.current[key].id;
      }
      const response = await api.post(kind === 'direct' ? '/chat' : threadPath(kind, selected.id), body, config());
      const saved = response.data?.data?.message;
      if (saved && selectedKey.current === key) setMessages(previous => [...new Map([...previous, saved].map(message => [identity(message), message])).values()]);
      setDrafts(previous => ({...previous, [key]: previous[key]?.trim() === text ? '' : previous[key]})); delete clientIds.current[key];
      if (selectedKey.current === key) { await loadThread(); await loadInbox(); }
    } catch (failure) { if (selectedKey.current === key) setThreadError(failure.response?.data?.message || 'Message was not sent. Your draft is saved.'); }
    finally { sendingRef.current = false; setSending(false); }
  };
  return <div className={styles.page}>
    <header className={styles.header}><div><h1><MessagesSquare /> Account messages</h1><p>Managing conversations for <strong>{user?.branding?.store_name || user?.name || 'this account'}</strong></p></div><button type="button" onClick={() => { loadInbox(); loadThread(); }}><RefreshCw size={16} /> Refresh</button></header>
    <div className={styles.tabs} role="group" aria-label="Conversation type">{TABS.map(tab => <button type="button" key={tab.id} aria-pressed={kind === tab.id} onClick={() => { setSelected(null); setKind(tab.id); }}>{tab.label}</button>)}</div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.layout}>
      <section className={styles.list} data-hidden={Boolean(selected)} aria-label="Account conversations">
        <label className={styles.search}><Search size={16} /><input aria-label="Search account conversations" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a conversation" /></label>
        {loading ? <p className={styles.empty} role="status">Loading messages...</p> : threads.filter(thread => (thread.name + ' ' + thread.preview).toLowerCase().includes(query.toLowerCase())).map(thread => <button type="button" className={styles.thread} aria-pressed={selected?.id === thread.id} key={thread.id} onClick={() => setSelected(thread)}><span><strong>{thread.name}</strong><small>{thread.preview || 'Open conversation'}</small></span>{thread.unread > 0 && <b aria-label={thread.unread + ' unread'}>{thread.unread}</b>}</button>)}
        {!loading && !threads.length && !error && <p className={styles.empty}>No conversations yet. Customer, order and delivery conversations appear here.</p>}
      </section>
      <section className={styles.conversation} data-open={Boolean(selected)} aria-label="Managed conversation">
        {selected ? <><div className={styles.conversationHeader}><button type="button" className={styles.back} aria-label="Back to conversations" onClick={() => setSelected(null)}><ArrowLeft size={18} /></button><h2>{selected.name}</h2></div>
          <div className={styles.messages} aria-live="polite">{kind === 'direct' && messages.length < total && <button type="button" onClick={() => loadThread(page + 1)}>Load earlier messages</button>}{loadingThread ? <p role="status">Loading conversation...</p> : messages.map(message => <article key={identity(message)} className={styles.bubble} data-own={identity(message.sender_id) === accountId}><strong>{identity(message.sender_id) === accountId ? 'Sent as ' + (user?.branding?.store_name || user?.name || 'this account') : message.sender_name || message.sender_id?.name || selected.name}</strong><p>{message.text || 'Shared attachment'}</p><time>{date(message.createdAt || message.timestamp)}</time></article>)}{!loadingThread && !messages.length && <p className={styles.empty}>No messages in this conversation yet.</p>}</div>
          {threadError && <p role="alert" className={styles.error}>{threadError}</p>}
          <form className={styles.form} onSubmit={send}><textarea aria-label="Message as managed account" value={drafts[currentKey] || ''} maxLength={2000} placeholder={"Reply as " + (user?.branding?.store_name || user?.name || "this account")} onChange={event => { const value = event.target.value; setDrafts(previous => ({...previous, [currentKey]: value})); }} /><button type="submit" disabled={sending || loadingThread || !(drafts[currentKey] || '').trim()}><Send size={16} /> Send</button></form>
        </> : <p className={styles.empty}>Choose a conversation to read and reply as this account.</p>}
      </section>
    </div>
  </div>;
}
