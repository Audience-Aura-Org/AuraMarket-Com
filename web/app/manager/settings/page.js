'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Settings, RefreshCw, Save, User } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '@/services/api';

export default function ManagerSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/manager/settings');
      setSettings(res.data?.data || {});
    } catch (err) {
      console.error('[Manager] Failed to load settings:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const toggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch('/manager/settings', {
        notify_email: !!settings.notify_email,
        notify_push: !!settings.notify_push,
        daily_digest: !!settings.daily_digest,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('[Manager] Failed to save settings:', err.message);
    } finally {
      setSaving(false);
    }
  };

  const TOGGLES = [
    { key: 'notify_email', label: 'Email Notifications', desc: 'Receive email alerts for important events' },
    { key: 'notify_push', label: 'Push Notifications', desc: 'Get browser push notifications in real-time' },
    { key: 'daily_digest', label: 'Daily Digest', desc: 'Receive a daily summary email of all activity' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">
            Preferences
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Manager notification and display settings
          </p>
        </div>
        <button
          onClick={fetchSettings}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Profile Info */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl p-5 backdrop-blur-sm"
      >
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-blue-400" />
          Profile
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Name</label>
              <p className="text-sm text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg px-3 py-2">
                {settings.name || '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Email</label>
              <p className="text-sm text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg px-3 py-2">
                {settings.email || '—'}
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Notification Toggles */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl p-5 backdrop-blur-sm"
      >
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-purple-400" />
          Notifications
        </h2>

        <div className="space-y-4">
          {TOGGLES.map((t) => (
            <div key={t.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-primary)] font-medium">{t.label}</p>
                <p className="text-xs text-[var(--text-muted)]">{t.desc}</p>
              </div>
              <button
                onClick={() => toggle(t.key)}
                disabled={loading}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings[t.key] ? 'bg-[var(--accent)]' : 'bg-[var(--bg-secondary)] border border-[var(--glass-border)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    settings[t.key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={saveSettings}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm text-emerald-400"
            >
              Saved successfully
            </motion.span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
