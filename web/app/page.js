"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

import StatusRow from '@/components/status/StatusRow';
import VendorListPanel from '@/components/hub/VendorListPanel';

const StatusViewer = dynamic(() => import('@/components/status/StatusViewer'), { ssr: false });
const StatusCreator = dynamic(() => import('@/components/status/StatusCreator'), { ssr: false });

export default function VendorsDirectoryPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  
  // Status States
  const [followedStatuses, setFollowedStatuses] = useState([]);
  const [viewingStatuses, setViewingStatuses] = useState(null);
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [showCreator, setShowCreator] = useState(false);

  // Authentication check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const fetchFollowedStatuses = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get('/statuses', { 
        params: { mode: user ? 'followed' : 'global', limit: 20 } 
      });
      if (res.data.success) {
        const data = res.data.data || [];
        setFollowedStatuses(data);
        
        data.forEach(s => {
          if (s.type === 'image' && s.content_url) {
            const img = new Image();
            img.src = s.content_url;
          }
        });
      }
    } catch (e) { 
      console.error('[Home] Failed to fetch statuses:', e); 
      setFollowedStatuses([]);
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    fetchFollowedStatuses();
  }, [fetchFollowedStatuses]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center">
        <Loader2 className="animate-spin text-[var(--accent)]" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex flex-col pt-[env(safe-area-inset-top)] pb-24">
      <div className="flex flex-col relative flex-1">
        
        {/* Status Row (Story Circles) */}
        {(followedStatuses?.length > 0 || user?.role === 'vendor') && (
          <div className="sticky top-0 z-[35] bg-[var(--bg-secondary)]/80 backdrop-blur-2xl border-b border-white/5 shadow-sm overflow-hidden">
            <StatusRow 
              statuses={followedStatuses} 
              onSelect={(items, storyId) => {
                setViewingStatuses(items);
                setSelectedStoryId(storyId);
              }}
              onAdd={() => setShowCreator(true)}
              isVendor={user?.role === 'vendor'}
            />
          </div>
        )}
        
        {/* Vendor List (WhatsApp Style) */}
        <div className="flex flex-col">
          <VendorListPanel 
            followedStatuses={followedStatuses} 
            onOpenStatus={(vendorId) => {
              const items = followedStatuses.filter(s => s.vendor_id?._id === vendorId);
              if (items.length > 0) {
                setViewingStatuses(followedStatuses);
                setSelectedStoryId(items[0]._id);
              }
            }}
          />
        </div>

      </div>

      {/* Status Overlays */}
      <AnimatePresence>
        {viewingStatuses && (
          <StatusViewer 
            initialStatuses={viewingStatuses}
            initialStoryId={selectedStoryId}
            onClose={() => {
              setViewingStatuses(null);
              setSelectedStoryId(null);
            }} 
          />
        )}
        {showCreator && (
          <StatusCreator 
            onClose={() => setShowCreator(false)}
            onStatusCreated={(newStatus) => {
              fetchFollowedStatuses();
              setShowCreator(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
