'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useAuthStore } from '@/hooks/useAuth';

const ROUTE_STACK_KEY = 'aura_route_stack';
const MAX_STACK_SIZE = 40;

export default function NativeBackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const routeStackRef = useRef([]);
  const searchString = searchParams?.toString() || '';

  const currentRoute = useMemo(() => {
    return `${pathname || '/'}${searchString ? `?${searchString}` : ''}`;
  }, [pathname, searchString]);

  const fallbackRoute = useMemo(() => {
    if (!isAuthenticated) return '/login';
    if (user?.role === 'admin') return '/admin/dashboard';
    if (user?.role === 'vendor') return '/vendor/dashboard';
    if (user?.role === 'logistics') return '/logistics/dashboard';
    return '/shop';
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(ROUTE_STACK_KEY) || '[]');
      routeStackRef.current = Array.isArray(stored) ? stored : [];
    } catch {
      routeStackRef.current = [];
    }
  }, []);

  useEffect(() => {
    if (!currentRoute) return;

    const stack = routeStackRef.current;
    if (stack[stack.length - 1] !== currentRoute) {
      stack.push(currentRoute);
      routeStackRef.current = stack.slice(-MAX_STACK_SIZE);
      try {
        window.sessionStorage.setItem(ROUTE_STACK_KEY, JSON.stringify(routeStackRef.current));
      } catch {}
    }
  }, [currentRoute]);

  const goToPreviousInAppRoute = () => {
    const stack = [...routeStackRef.current];

    while (stack.length && stack[stack.length - 1] === currentRoute) {
      stack.pop();
    }

    const previousRoute = stack[stack.length - 1];
    routeStackRef.current = stack.slice(-MAX_STACK_SIZE);

    try {
      window.sessionStorage.setItem(ROUTE_STACK_KEY, JSON.stringify(routeStackRef.current));
    } catch {}

    if (previousRoute && previousRoute !== currentRoute) {
      router.replace(previousRoute);
      return;
    }

    if (currentRoute !== fallbackRoute) {
      router.replace(fallbackRoute);
    }
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let listener;
    let cancelled = false;

    const attach = async () => {
      listener = await App.addListener('backButton', () => {
        goToPreviousInAppRoute();
      });

      if (cancelled && listener) {
        listener.remove();
      }
    };

    attach();

    return () => {
      cancelled = true;
      if (listener) listener.remove();
    };
  }, [currentRoute, fallbackRoute, router]);

  return null;
}
