"use client";

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/hooks/useAuth';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
];

const STORAGE_KEY = 'aura_language';

const labelSlug = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

const SYSTEM_TRANSLATIONS = {
  en: {
    'common.all': 'All',
    'common.market': 'Market',
    'common.back': 'Back',
    'common.selected': 'Selected',
    'common.loadingCategories': 'Loading categories...',
    'common.noSubcategories': 'No subcategories - "{value}" selected',
    'common.follow': 'Follow',
    'common.following': 'Following',
    'common.chat': 'Chat',
    'common.contact': 'Contact',
    'common.buyNow': 'Buy now',
    'common.outOfStock': 'Out of stock',
    'common.addedToCart': '{name} added to cart',
    'common.loginCart': 'Please login to activate cart',
    'common.loginProceed': 'Please login to proceed',
    'common.loginWishlist': 'Please login to wishlist',
    'common.loginChat': 'Please login to chat',
    'common.wishlistFailed': 'Failed to update wishlist',
    'common.verifiedVendor': 'Verified vendor',
    'common.verifiedStore': 'Verified Store',
    'common.globalMarket': 'Global Market',
    'common.results': 'Results',
    'common.price': 'Price',
    'common.anyPrice': 'Any Price',
    'common.sort': 'Sort',
    'common.shopSyncing': 'Shop syncing',
    'common.noProductsFound': 'No Products Found',
    'common.productsArrive': 'Products appear here as soon as the latest shop feed arrives.',
    'common.noMatches': 'No matches found for your current search or filters.',
    'common.resetFilters': 'Reset Filters',
    'common.network': 'Network',
    'common.walletBalance': 'Wallet balance',
    'search.productsPlaceholder': 'Search premium products...',
    'search.ordersPlaceholder': 'Search by order ID or product',
    'role.customer': 'customer',
    'role.vendor': 'vendor',
    'role.logistics': 'logistics',
    'orders.title': 'Orders',
    'orders.vendorHelp': 'Track purchases you made and sales from your store.',
    'orders.customerHelp': 'View and track your order history.',
    'orders.refresh': 'Refresh',
    'orders.myPurchases': 'My purchases',
    'orders.mySales': 'My sales',
    'orders.total': 'Total',
    'orders.active': 'Active',
    'orders.completed': 'Completed',
    'orders.issues': 'Issues',
    'orders.history': 'Order history',
    'orders.shown': '{count} shown',
    'orders.loading': 'Loading orders...',
    'orders.none': 'No orders found.',
    'orders.item': 'item',
    'orders.items': 'items',
    'status.all': 'All',
    'status.placed': 'Placed',
    'status.processing': 'Processing',
    'status.shipped': 'Shipped',
    'status.completed': 'Completed',
    'status.failed': 'Failed',
    'status.cancelled': 'Cancelled',
    'status.refunded': 'Refunded',
    'status.delivered': 'Delivered',
    'status.pending': 'Pending',
    'status.refundedToWallet': 'Refunded to wallet',
    'status.refundPending': 'Refund pending',
    'status.walletCredited': 'Wallet credited',
    'status.payOnDelivery': 'Pay on delivery',
    'status.paid': 'Paid',
    'sort.newest': 'Newest Arrivals',
    'sort.priceLowHigh': 'Price: Low to High',
    'sort.priceHighLow': 'Price: High to Low',
    'sort.highestRated': 'Highest Rated',
    'price.under5000': 'Under 5,000 XAF',
    'price.5000to10000': '5,000 - 10,000 XAF',
    'price.10000to50000': '10,000 - 50,000 XAF',
    'price.over50000': 'Over 50,000 XAF',
    'label.electronics': 'Electronics',
    'label.mens.clothing': 'Mens Clothing',
    'label.health.and.fitness': 'Health & Fitness',
    'label.laptops': 'Laptops',
    'label.smartwatches': 'Smartwatches',
    'label.shoulder.bags': 'Shoulder Bags',
    'label.hoodies': 'Hoodies',
    'label.charcoal.grills': 'Charcoal Grills',
    'label.keyboards.and.mice': 'Keyboards & Mice',
    'label.books': 'Books',
    'label.printed.books': 'Printed Books',
    'label.fiction': 'Fiction',
    'label.non.fiction': 'Non-Fiction',
    'label.childrens.books': "Children's Books",
    'label.graphic.novels': 'Graphic Novels',
    'label.poetry': 'Poetry',
    'label.home.and.kitchen': 'Home & Kitchen',
    'label.fashion.and.lifestyle': 'Fashion & Lifestyle',
    'label.beauty.and.personal.care': 'Beauty & Personal Care',
    'label.kids.and.baby.clothing': 'Kids & Baby Clothing',
    'label.sports.and.outdoors': 'Sports & Outdoors',
    'label.flash.sale': 'Flash Sale',
    'label.new.arrival': 'New Arrival',
    'label.available.for.delivery': 'Available for Delivery',
    'label.looking.for': 'Looking For',
    'label.store.update': 'Store Update',
    'label.moment': 'Moment',
    'label.review.and.recommend': 'Review & Recommend',
    'label.trade.swap': 'Trade / Swap',
    'label.service.offer': 'Service Offer',
    'label.order.update': 'Order Update',
    'label.alert': 'Alert',
    'label.community': 'Community',
  },
  fr: {
    'common.all': 'Tout',
    'common.market': 'Marche',
    'common.back': 'Retour',
    'common.selected': 'Selectionne',
    'common.loadingCategories': 'Chargement des categories...',
    'common.noSubcategories': 'Aucune sous-categorie - "{value}" selectionne',
    'common.follow': 'Suivre',
    'common.following': 'Suivi',
    'common.chat': 'Discussion',
    'common.contact': 'Contacter',
    'common.buyNow': 'Acheter',
    'common.outOfStock': 'Rupture',
    'common.addedToCart': '{name} ajoute au panier',
    'common.loginCart': 'Connectez-vous pour utiliser le panier',
    'common.loginProceed': 'Connectez-vous pour continuer',
    'common.loginWishlist': 'Connectez-vous pour ajouter aux favoris',
    'common.loginChat': 'Connectez-vous pour discuter',
    'common.wishlistFailed': 'Impossible de mettre a jour les favoris',
    'common.verifiedVendor': 'Vendeur verifie',
    'common.verifiedStore': 'Boutique verifiee',
    'common.globalMarket': 'Marche global',
    'common.results': 'Resultats',
    'common.price': 'Prix',
    'common.anyPrice': 'Tous les prix',
    'common.sort': 'Trier',
    'common.shopSyncing': 'Synchronisation',
    'common.noProductsFound': 'Aucun produit trouve',
    'common.productsArrive': 'Les produits apparaissent ici des que la boutique se synchronise.',
    'common.noMatches': 'Aucun resultat pour votre recherche ou vos filtres.',
    'common.resetFilters': 'Reinitialiser',
    'common.network': 'Reseau',
    'common.walletBalance': 'Solde wallet',
    'search.productsPlaceholder': 'Rechercher des produits premium...',
    'search.ordersPlaceholder': 'Rechercher par commande ou produit',
    'role.customer': 'client',
    'role.vendor': 'vendeur',
    'role.logistics': 'logistique',
    'orders.title': 'Commandes',
    'orders.vendorHelp': 'Suivez vos achats et les ventes de votre boutique.',
    'orders.customerHelp': 'Consultez et suivez votre historique de commandes.',
    'orders.refresh': 'Actualiser',
    'orders.myPurchases': 'Mes achats',
    'orders.mySales': 'Mes ventes',
    'orders.total': 'Total',
    'orders.active': 'Actives',
    'orders.completed': 'Terminees',
    'orders.issues': 'Problemes',
    'orders.history': 'Historique',
    'orders.shown': '{count} affiches',
    'orders.loading': 'Chargement des commandes...',
    'orders.none': 'Aucune commande trouvee.',
    'orders.item': 'article',
    'orders.items': 'articles',
    'status.all': 'Tout',
    'status.placed': 'Placee',
    'status.processing': 'En traitement',
    'status.shipped': 'Expediee',
    'status.completed': 'Terminee',
    'status.failed': 'Echouee',
    'status.cancelled': 'Annulee',
    'status.refunded': 'Remboursee',
    'status.delivered': 'Livree',
    'status.pending': 'En attente',
    'status.refundedToWallet': 'Rembourse sur wallet',
    'status.refundPending': 'Remboursement en attente',
    'status.walletCredited': 'Wallet credite',
    'status.payOnDelivery': 'Paiement a la livraison',
    'status.paid': 'Paye',
    'sort.newest': 'Nouveautes',
    'sort.priceLowHigh': 'Prix croissant',
    'sort.priceHighLow': 'Prix decroissant',
    'sort.highestRated': 'Mieux notes',
    'price.under5000': 'Moins de 5 000 XAF',
    'price.5000to10000': '5 000 - 10 000 XAF',
    'price.10000to50000': '10 000 - 50 000 XAF',
    'price.over50000': 'Plus de 50 000 XAF',
    'label.electronics': 'Electronique',
    'label.mens.clothing': 'Vetements homme',
    'label.health.and.fitness': 'Sante et fitness',
    'label.laptops': 'Ordinateurs portables',
    'label.smartwatches': 'Montres connectees',
    'label.shoulder.bags': 'Sacs a bandouliere',
    'label.hoodies': 'Sweats a capuche',
    'label.charcoal.grills': 'Barbecues au charbon',
    'label.keyboards.and.mice': 'Claviers et souris',
    'label.books': 'Livres',
    'label.printed.books': 'Livres imprimes',
    'label.fiction': 'Fiction',
    'label.non.fiction': 'Non-fiction',
    'label.childrens.books': 'Livres enfants',
    'label.graphic.novels': 'Romans graphiques',
    'label.poetry': 'Poesie',
    'label.home.and.kitchen': 'Maison et cuisine',
    'label.fashion.and.lifestyle': 'Mode et lifestyle',
    'label.beauty.and.personal.care': 'Beaute et soins',
    'label.kids.and.baby.clothing': 'Vetements enfants et bebe',
    'label.sports.and.outdoors': 'Sports et exterieur',
    'label.flash.sale': 'Vente flash',
    'label.new.arrival': 'Nouveaute',
    'label.available.for.delivery': 'Disponible en livraison',
    'label.looking.for': 'Recherche',
    'label.store.update': 'Info boutique',
    'label.moment': 'Moment',
    'label.review.and.recommend': 'Avis et recommandation',
    'label.trade.swap': 'Echange',
    'label.service.offer': 'Offre de service',
    'label.order.update': 'Suivi commande',
    'label.alert': 'Alerte',
    'label.community': 'Communaute',
  },
};

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
    ...SYSTEM_TRANSLATIONS.en,
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
    ...SYSTEM_TRANSLATIONS.fr,
  },
};

const normalizeLanguage = (value) =>
  SUPPORTED_LANGUAGES.some((language) => language.code === value) ? value : 'en';

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: (key, fallback, replacements) => fallback || key,
  label: (value, fallback) => fallback || value,
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
      if (typeof document !== 'undefined') {
        document.documentElement.lang = normalized;
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, normalized);
        window.dispatchEvent(new CustomEvent('aura:language-change', { detail: { language: normalized } }));
      } catch {}
    },
    t: (key, fallback, replacements = {}) => {
      const template = translations[language]?.[key] || translations.en[key] || fallback || key;
      return Object.entries(replacements).reduce(
        (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
        String(template)
      );
    },
    label: (value, fallback) => {
      const original = fallback || value;
      const key = `label.${labelSlug(value)}`;
      return translations[language]?.[key] || translations.en[key] || original;
    },
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
