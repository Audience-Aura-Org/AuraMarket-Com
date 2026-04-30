"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';
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
  const { user } = useAuthStore();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const abortControllerRef = useRef(null);

  const checkFollowStatus = useCallback(async () => {
    if (!user || !vendorId) {
      setStatusLoading(false);
      return;
    }

    const cacheKey = `${user._id}-${vendorId}`;

    // Return cached result if available
    if (followStatusCache.has(cacheKey)) {
      const cachedValue = followStatusCache.get(cacheKey);
      setIsFollowing(cachedValue);
      setStatusLoading(false);
      return;
    }

    // Deduplicate pending requests - if already requesting, wait for it
    if (pendingRequests.has(cacheKey)) {
      try {
        const result = await pendingRequests.get(cacheKey);
        setIsFollowing(result);
      } catch (err) {
        console.error('Failed to check follow status:', err);
      } finally {
        setStatusLoading(false);
      }
      return;
    }

    // Create new request with timeout
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for this request

    const requestPromise = (async () => {
      try {
        const res = await api.get(`/vendors/${vendorId}/follow-status`, {
          signal: controller.signal
        });
        
        if (res.data.success) {
          const isFollowingValue = res.data.is_following;
          followStatusCache.set(cacheKey, isFollowingValue);
          return isFollowingValue;
        }
        return false;
      } catch (err) {
        // Handle cancellations silently - don't rethrow
        // Check for both AbortError (native) and CanceledError (axios)
        const isAbortedOrCanceled = err.name === 'AbortError' || err.code === 'ERR_CANCELED';
        if (!isAbortedOrCanceled) {
          // Re-throw non-cancellation errors to be handled by outer catch
          throw err;
        }
        return false; // Default to not following on cancellation
      } finally {
        clearTimeout(timeoutId);
        pendingRequests.delete(cacheKey);
      }
    })();

    pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      setIsFollowing(result);
    } catch (err) {
      console.error('Failed to check follow status:', err);
      setIsFollowing(false); // Default to not following on error
    } finally {
      setStatusLoading(false);
    }
  }, [user, vendorId]);

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    checkFollowStatus();

    return () => {
      // Cancel request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [checkFollowStatus]);

  const toggleFollow = async () => {
    if (!user) {
      alert('Please login to follow vendors');
      return;
    }

    if (!vendorId) return;

    // Optimistic Update
    const prevStatus = isFollowing;
    setIsFollowing(!prevStatus);
    setLoading(true);

    try {
      const cacheKey = `${user._id}-${vendorId}`;
      
      if (prevStatus) {
        // Unfollow
        await api.delete(`/vendors/${vendorId}/follow`);
        followStatusCache.set(cacheKey, false);
      } else {
        // Follow
        await api.post(`/vendors/${vendorId}/follow`);
        followStatusCache.set(cacheKey, true);
      }
    } catch (err) {
      console.error('Follow toggle failed:', err);
      // Revert on error
      setIsFollowing(prevStatus);
      alert('Follow action failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return {
    isFollowing,
    toggleFollow,
    loading: loading || statusLoading,
    statusLoading
  };
}
