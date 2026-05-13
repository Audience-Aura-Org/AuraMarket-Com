import {
  User, Bell, Shield, Lock, Store, ShieldAlert,
  Database, Mail, Truck, LayoutGrid, ShoppingBag,
  Activity, Users, Heart, ShieldCheck, Star
} from 'lucide-react';

export const TABS = [
  { id: 'general', label: 'Profile', icon: User, roles: ['customer', 'vendor', 'admin', 'logistics'] },
  { id: 'orders', label: 'Orders', icon: ShoppingBag, roles: ['customer', 'vendor'] },
  { id: 'wishlist', label: 'Wishlist', icon: Heart, roles: ['customer', 'vendor'] },
  { id: 'security', label: 'Security', icon: Shield, roles: ['customer', 'vendor', 'admin', 'logistics'] },
  { id: 'network', label: 'Network', icon: Users, roles: ['customer', 'vendor'] },
  { id: 'audience', label: 'Audience', icon: Heart, roles: ['vendor'] },
  { id: 'store', label: 'Store', icon: Store, roles: ['vendor'] },
  { id: 'statuses', label: 'Stories', icon: Activity, roles: ['vendor', 'admin'] },
  { id: 'fleet', label: 'Fleet', icon: Truck, roles: ['logistics'] },
  { id: 'governance', label: 'Governance', icon: ShieldAlert, roles: ['admin'] },
  { id: 'kyc', label: 'Verification', icon: ShieldCheck, roles: ['customer', 'vendor'] },
  { id: 'notifications', label: 'Alerts', icon: Bell, roles: ['customer', 'vendor', 'admin', 'logistics'] },
  { id: 'advanced', label: 'Advanced', icon: Database, roles: ['admin'] },
];
