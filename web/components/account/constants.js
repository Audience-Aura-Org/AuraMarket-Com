import {
  User, Bell, Shield, Store, ShieldAlert,
  Database, Truck, ShoppingBag,
  Users, Heart, ShieldCheck, Smartphone
} from 'lucide-react';

export const TABS = [
  { id: 'general',       label: 'Profile',      icon: User,        roles: ['customer', 'vendor', 'admin', 'logistics'] },
  { id: 'store',         label: 'Store',         icon: Store,       roles: ['vendor'] },
  { id: 'orders',        label: 'Orders',        icon: ShoppingBag, roles: ['customer', 'vendor'] },
  { id: 'audience',      label: 'Audience',      icon: Heart,       roles: ['vendor'] },
  { id: 'network',       label: 'Network',       icon: Users,       roles: ['customer', 'vendor'] },
  { id: 'wishlist',      label: 'Wishlist',      icon: Heart,       roles: ['customer', 'vendor'] },
  { id: 'kyc',           label: 'Verification',  icon: ShieldCheck, roles: ['customer', 'vendor'] },
  { id: 'notifications', label: 'Alerts',        icon: Bell,        roles: ['customer', 'vendor', 'admin', 'logistics'] },
  { id: 'security',      label: 'Security',      icon: Shield,      roles: ['customer', 'vendor', 'admin', 'logistics'] },
  { id: 'install',       label: 'Install App',   icon: Smartphone,  roles: ['customer', 'vendor', 'admin', 'logistics'] },
  { id: 'close-account', label: 'Close account', icon: ShieldAlert, roles: ['customer', 'vendor', 'admin', 'logistics'] },
];
