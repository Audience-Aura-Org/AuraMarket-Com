"use client";

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/hooks/useAuth';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
];

const STORAGE_KEY = 'aura_language';

const translations = {
  en: {
    'common.login': 'Login',
    'common.search': 'Search',
    'common.clearSearch': 'Clear search',
    'search.placeholder': 'Search products and stores',
    'nav.shop': 'Shop',
    'nav.vendors': 'Vendors',
    'nav.stories': 'Stories',
    'nav.story': 'Story',
    'nav.overtime': 'Overtime',
    'nav.profile': 'Profile',
    'nav.dashboard': 'Dashboard',
    'settings.title': 'Account Settings',
    'settings.identity': 'Identity Parameters',
    'settings.fullName': 'Full Name',
    'settings.phoneNumber': 'Phone Number',
    'settings.email': 'Email',
    'settings.language': 'Language',
    'settings.languageHelp': 'Choose the language used across Auradime on this device.',
    'settings.languageSaved': 'Language updated.',
    'settings.languageFailed': 'Language saved on this device. Account sync failed.',
    'settings.saving': 'Synchronizing state...',
    'settings.saveIdentity': 'Save identity configuration',
    'tabs.general': 'Profile',
    'tabs.orders': 'Orders',
    'tabs.wishlist': 'Wishlist',
    'tabs.security': 'Security',
    'tabs.close-account': 'Close account',
    'tabs.network': 'Network',
    'tabs.audience': 'Audience',
    'tabs.store': 'Store',
    'tabs.fleet': 'Fleet',
    'tabs.governance': 'Governance',
    'tabs.kyc': 'Verification',
    'tabs.notifications': 'Alerts',
    'tabs.advanced': 'Advanced',
  },
  fr: {
    'common.login': 'Connexion',
    'common.search': 'Rechercher',
    'common.clearSearch': 'Effacer la recherche',
    'search.placeholder': 'Rechercher des produits et boutiques',
    'nav.shop': 'Boutique',
    'nav.vendors': 'Vendeurs',
    'nav.stories': 'Stories',
    'nav.story': 'Story',
    'nav.overtime': 'Overtime',
    'nav.profile': 'Profil',
    'nav.dashboard': 'Tableau',
    'settings.title': 'Paramètres du compte',
    'settings.identity': 'Informations d’identité',
    'settings.fullName': 'Nom complet',
    'settings.phoneNumber': 'Numéro de téléphone',
    'settings.email': 'E-mail',
    'settings.language': 'Langue',
    'settings.languageHelp': 'Choisissez la langue utilisée sur Auradime sur cet appareil.',
    'settings.languageSaved': 'Langue mise à jour.',
    'settings.languageFailed': 'Langue enregistrée sur cet appareil. Synchronisation du compte échouée.',
    'settings.saving': 'Synchronisation...',
    'settings.saveIdentity': 'Enregistrer les informations',
    'tabs.general': 'Profil',
    'tabs.orders': 'Commandes',
    'tabs.wishlist': 'Favoris',
    'tabs.security': 'Sécurité',
    'tabs.close-account': 'Fermer le compte',
    'tabs.network': 'Réseau',
    'tabs.audience': 'Audience',
    'tabs.store': 'Boutique',
    'tabs.fleet': 'Flotte',
    'tabs.governance': 'Gouvernance',
    'tabs.kyc': 'Vérification',
    'tabs.notifications': 'Alertes',
    'tabs.advanced': 'Avancé',
  },
};

const normalizeLanguage = (value) =>
  SUPPORTED_LANGUAGES.some((language) => language.code === value) ? value : 'en';

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: (key, fallback) => fallback || key,
  languages: SUPPORTED_LANGUAGES,
});

export function LanguageProvider({ children }) {
  const userLanguage = useAuthStore((state) => state.user?.preferred_language);
  const [language, setLanguageState] = useState('en');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setLanguageState(normalizeLanguage(userLanguage || stored || 'en'));
  }, [userLanguage]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {}
  }, [language]);

  const value = useMemo(() => ({
    language,
    languages: SUPPORTED_LANGUAGES,
    setLanguage: (nextLanguage) => setLanguageState(normalizeLanguage(nextLanguage)),
    t: (key, fallback) => translations[language]?.[key] || translations.en[key] || fallback || key,
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
