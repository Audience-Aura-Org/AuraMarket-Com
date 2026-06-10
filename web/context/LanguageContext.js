"use client";

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/hooks/useAuth';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
];

const STORAGE_KEY = 'aura_language';

const readStoredLanguage = () => {
  if (typeof window === 'undefined') return 'en';
  try {
    return normalizeLanguage(window.localStorage.getItem(STORAGE_KEY) || 'en');
  } catch {
    return 'en';
  }
};

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
    'login.tagline': 'Secure email verification',
    'login.welcome': 'Welcome to Aura Dime',
    'login.emailHelp': 'Enter your email and we will send a verification code.',
    'login.sendCode': 'Send code',
    'login.enterCode': 'Enter code',
    'login.haveCode': 'I already have a code',
    'login.checkEmail': 'Check your email',
    'login.changeEmail': 'Change email',
    'login.verifyCode': 'Verify code',
    'login.resendCode': 'Resend code',
    'login.resendIn': 'Resend code in {seconds}s',
    'login.createAccount': 'Create your account',
    'login.fullNameRequired': 'Full name is required.',
    'login.phoneRequired': 'Phone number is required.',
    'login.fullName': 'Full name',
    'login.phoneNumber': 'Phone number',
    'login.continueAs': 'Continue as',
    'login.onboardingHint': 'After this, we will open the guided onboarding flow to finish your role setup.',
    'login.continueOnboarding': 'Continue to onboarding',
    'login.legalPrefix': "By continuing, you acknowledge Auradime's",
    'login.terms': 'Terms',
    'login.privacy': 'Privacy Policy',
    'login.cookies': 'Cookie Policy',
    'login.legalMiddle': 'and',
    'login.legalSuffix': 'plus the marketplace policies in the',
    'login.legalCenter': 'Legal Center',
    'login.existingCodeNotice': 'Enter the code we already sent. You can request a new one when the timer ends.',
    'login.requestTimeout': 'The code request is taking too long. Please check your connection or try another network.',
    'login.codeArrivedNotice': 'If the code arrived, enter it here. You can resend when the timer ends.',
    'login.codeSent': 'Verification code sent',
    'login.verifyTimeout': 'Verification is taking too long. Please try again.',
    'login.setupTimeout': 'Account setup is taking too long. Please try again.',
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
    'login.tagline': 'Vérification sécurisée par e-mail',
    'login.welcome': 'Bienvenue sur Aura Dime',
    'login.emailHelp': 'Entrez votre e-mail et nous vous enverrons un code de vérification.',
    'login.sendCode': 'Envoyer le code',
    'login.enterCode': 'Entrer le code',
    'login.haveCode': "J’ai déjà un code",
    'login.checkEmail': 'Vérifiez votre e-mail',
    'login.changeEmail': "Changer l’e-mail",
    'login.verifyCode': 'Vérifier le code',
    'login.resendCode': 'Renvoyer le code',
    'login.resendIn': 'Renvoyer le code dans {seconds}s',
    'login.createAccount': 'Créer votre compte',
    'login.fullNameRequired': 'Le nom complet est requis.',
    'login.phoneRequired': 'Le numéro de téléphone est requis.',
    'login.fullName': 'Nom complet',
    'login.phoneNumber': 'Numéro de téléphone',
    'login.continueAs': 'Continuer comme',
    'login.onboardingHint': 'Ensuite, nous ouvrirons le parcours guidé pour terminer la configuration de votre rôle.',
    'login.continueOnboarding': 'Continuer vers l’onboarding',
    'login.legalPrefix': 'En continuant, vous acceptez les',
    'login.terms': 'Conditions',
    'login.privacy': 'Politique de confidentialité',
    'login.cookies': 'Politique des cookies',
    'login.legalMiddle': 'et',
    'login.legalSuffix': 'ainsi que les règles du marketplace dans le',
    'login.legalCenter': 'Centre légal',
    'login.existingCodeNotice': 'Entrez le code déjà envoyé. Vous pourrez demander un nouveau code à la fin du compte à rebours.',
    'login.requestTimeout': 'La demande de code prend trop de temps. Vérifiez votre connexion ou essayez un autre réseau.',
    'login.codeArrivedNotice': 'Si le code est arrivé, entrez-le ici. Vous pourrez le renvoyer à la fin du compte à rebours.',
    'login.codeSent': 'Code de vérification envoyé',
    'login.verifyTimeout': 'La vérification prend trop de temps. Veuillez réessayer.',
    'login.setupTimeout': 'La création du compte prend trop de temps. Veuillez réessayer.',
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
  t: (key, fallback, replacements) => fallback || key,
  languages: SUPPORTED_LANGUAGES,
});

export function LanguageProvider({ children }) {
  const userLanguage = useAuthStore((state) => state.user?.preferred_language);
  const [language, setLanguageState] = useState(readStoredLanguage);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored && userLanguage) {
      setLanguageState(normalizeLanguage(userLanguage));
    }
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
    setLanguage: (nextLanguage) => {
      const normalized = normalizeLanguage(nextLanguage);
      setLanguageState(normalized);
      try {
        window.localStorage.setItem(STORAGE_KEY, normalized);
      } catch {}
    },
    t: (key, fallback, replacements = {}) => {
      const template = translations[language]?.[key] || translations.en[key] || fallback || key;
      return Object.entries(replacements).reduce(
        (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
        String(template)
      );
    },
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
