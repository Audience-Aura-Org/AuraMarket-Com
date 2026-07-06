"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/hooks/useAuth';

// Request cache to prevent duplicate requests for the same vendor
const followStatusCache = new Map();
const pendingRequests = new Map();

/**
 * useFollow Hook
 * Manages follow/unfollow logic for vendors.
 * Handles state synchronization, optimistic updates, and request deduplication.
 */
export function useFollow(vendorId) {
  const { user, followedVendorIds, fetchFollowedVendors } = useAuthStore();
  
  // 1. Initialize state immediately from the global store to avoid flicker
  const [isFollowing, setIsFollowing] = useState(() => {
    if (!vendorId || !followedVendorIds) return false;
    return followedVendorIds.includes(vendorId);
  });
  const [loading, setLoading] = useState(false);
  
  // 2. Sync local status if the global store changes (e.g. hydrate or follow elsewhere)
  useEffect(() => {
    if (!vendorId) return;
    setIsFollowing(followedVendorIds.includes(vendorId));
  }, [vendorId, followedVendorIds]);

  // 2. Fetch global followed list on first mount if empty and user exists
  useEffect(() => {
    if (user && followedVendorIds.length === 0) {
      fetchFollowedVendors();
    }
  }, [user, followedVendorIds.length, fetchFollowedVendors]);

  // 3. Listen for global events (optional backup)
  useEffect(() => {
    const handleGlobalUpdate = (e) => {
      if (e.detail.vendorId === vendorId) {
        setIsFollowing(e.detail.isFollowing);
      }
    };
    window.addEventListener('aura_follow_update', handleGlobalUpdate);
    return () => window.removeEventListener('aura_follow_update', handleGlobalUpdate);
  }, [vendorId]);

  const toggleFollow = async () => {
    if (!user) {
      const from = typeof window !== 'undefined'
        ? encodeURIComponent(window.location.pathname + window.location.search)
        : '';
      window.location.href = `/login${from ? `?from=${from}` : ''}`;
      return;
    }

    if (!vendorId) return;

    const prevStatus = isFollowing;
    const newStatus = !prevStatus;
    
    // Update local state and global store immediately (optimistic)
    setIsFollowing(newStatus);
    if (newStatus) {
      useAuthStore.getState().addFollowedVendor(vendorId);
    } else {
      useAuthStore.getState().removeFollowedVendor(vendorId);
    }

    // Notify non-Zustand listeners
    window.dispatchEvent(new CustomEvent('aura_follow_update', { 
      detail: { vendorId, isFollowing: newStatus } 
    }));

    try {
      if (prevStatus) {
        await api.delete(`/vendors/${vendorId}/follow`);
      } else {
        await api.post(`/vendors/${vendorId}/follow`);
      }
      // Background sync to be 100% sure
      useAuthStore.getState().fetchFollowedVendors();
    } catch (err) {
      console.error('Follow toggle failed:', err);
      // Revert on error
      setIsFollowing(prevStatus);
      if (prevStatus) {
        useAuthStore.getState().addFollowedVendor(vendorId);
      } else {
        useAuthStore.getState().removeFollowedVendor(vendorId);
      }
      window.dispatchEvent(new CustomEvent('aura_follow_update', { 
        detail: { vendorId, isFollowing: prevStatus } 
      }));
      toast.error('Follow action failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return {
    isFollowing,
    toggleFollow,
    loading
  };
}
