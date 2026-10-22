'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';

/**
 * Data hook for manager pages.
 *
 * - First load sets `loading`; later loads keep `data` and set `refreshing`
 *   so pages never flash empty.
 * - Responses for a path/params combination that is no longer current are
 *   dropped (fast filter changes can't show stale results).
 * - Refetches when the window regains focus.
 */
export function useManagerQuery(path, params = null, { enabled = true } = {}) {
  const key = JSON.stringify([path, params]);
  const [state, setState] = useState({
    data: undefined,
    error: null,
    loading: enabled,
    refreshing: false,
  });
  const currentKey = useRef(key);
  currentKey.current = key;
  const hasData = useRef(false);

  const refetch = useCallback(async () => {
    const requestKey = key;
    setState((s) => ({ ...s, loading: !hasData.current, refreshing: hasData.current }));
    try {
      const res = await api.get(path, { params: params || undefined, skipClientCache: true });
      if (currentKey.current !== requestKey) return;
      hasData.current = true;
      setState({ data: res.data?.data, error: null, loading: false, refreshing: false });
    } catch (err) {
      if (currentKey.current !== requestKey) return;
      setState((s) => ({
        ...s,
        error: err?.response?.data?.message || err?.message || 'Something went wrong.',
        loading: false,
        refreshing: false,
      }));
    }
    // `key` captures path + params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (enabled) refetch();
  }, [refetch, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch, enabled]);

  return { ...state, refetch };
}
