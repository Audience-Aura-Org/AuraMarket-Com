/**
 * Rollout flags from GET /features (admin-controlled, all off by default).
 * Fetched once per page load and shared; any failure keeps everything off.
 */
import { useEffect, useState } from 'react';
import api from '@/services/api';

let request = null;
const loadFlags = () => {
  request ||= (async () => {
    try {
      const res = await api.get('/features');
      return res?.data?.data?.features || {};
    } catch {
      request = null; // retry on the next mount
      return {};
    }
  })();
  return request;
};

/** true when a boolean flag is on, or a mode flag is 'on' (pass `mode` to read 'shadow'). */
export const useFeatureFlag = (name, { mode = false } = {}) => {
  const [value, setValue] = useState(mode ? 'off' : false);
  useEffect(() => {
    let active = true;
    loadFlags().then((flags) => {
      if (!active) return;
      const raw = flags[name];
      setValue(mode ? (raw || 'off') : raw === true || raw === 'on');
    });
    return () => { active = false; };
  }, [name, mode]);
  return value;
};
