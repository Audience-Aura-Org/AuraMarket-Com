'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

const UploadQueueContext = createContext(null);

let _nextId = 1;

/**
 * UploadQueueProvider
 * Holds in-flight upload jobs at the app level — outside any modal or page lifecycle.
 * Jobs survive navigation: closing StatusCreator does NOT cancel the upload.
 */
export function UploadQueueProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  // Keep a ref too so callbacks (closures over stale state) can still read current jobs
  const jobsRef = useRef([]);

  const _setJobs = useCallback((updater) => {
    setJobs((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      jobsRef.current = next;
      return next;
    });
  }, []);

  const updateJob = useCallback((id, updates) => {
    _setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
  }, [_setJobs]);

  const removeJob = useCallback((id) => {
    _setJobs((prev) => prev.filter((j) => j.id !== id));
  }, [_setJobs]);

  /**
   * enqueueUpload(taskFn, options)
   *
   * taskFn receives { onProgress(0-100), onPhase(string) } and must return a Promise.
   * The Promise value is passed to options.onSuccess.
   *
   * Returns the job id immediately so callers can track if needed.
   */
  const enqueueUpload = useCallback((taskFn, {
    label = 'Uploading story...',
    onSuccess,
    onError,
  } = {}) => {
    const id = _nextId++;
    const job = { id, label, progress: 0, phase: 'Preparing...', status: 'active' };

    _setJobs((prev) => [...prev, job]);

    taskFn({
      onProgress: (pct) => updateJob(id, { progress: Math.min(100, Math.max(0, pct)) }),
      onPhase: (phase) => updateJob(id, { phase }),
    })
      .then((result) => {
        updateJob(id, { status: 'done', progress: 100 });
        toast.success('Story posted! 🎉', {
          id: `upload-done-${id}`,
          duration: 4000,
          style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(168,85,247,0.4)' },
        });
        onSuccess?.(result);
        // Auto-remove after showing done state briefly
        setTimeout(() => removeJob(id), 2500);
      })
      .catch((err) => {
        const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Story upload failed.';
        console.error('[UploadQueue] Upload failed:', errMsg, { status: err.response?.status, data: err.response?.data });
        updateJob(id, { status: 'error', error: errMsg });
        toast.error(errMsg, {
          id: `upload-error-${id}`,
          duration: 7000,
          style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(239,68,68,0.4)' },
        });
        onError?.(err);
        setTimeout(() => removeJob(id), 7000);
      });

    return id;
  }, [_setJobs, updateJob, removeJob]);

  return (
    <UploadQueueContext.Provider value={{ jobs, enqueueUpload }}>
      {children}
    </UploadQueueContext.Provider>
  );
}

export function useUploadQueue() {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) throw new Error('useUploadQueue must be inside UploadQueueProvider');
  return ctx;
}
