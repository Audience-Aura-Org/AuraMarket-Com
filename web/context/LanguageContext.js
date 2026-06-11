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
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLanguage(stored);

    const cookieMatch = document.cookie
      ?.split('; ')
      .find((row) => row.startsWith(`${STORAGE_KEY}=`))
      ?.split('=')[1];
    if (cookieMatch) return normalizeLanguage(decodeURIComponent(cookieMatch));

    const browserLanguage = navigator.languages?.[0] || navigator.language || '';
    return browserLanguage.toLowerCase().startsWith('fr') ? 'fr' : 'en';
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

const LEGAL_TEXT_TRANSLATIONS_FR = {
  'Back to login': 'Retour a la connexion',
  'Cameroon marketplace policy': 'Politique marketplace Cameroun',
  'Legal Center': 'Centre legal',
  'Last updated:': 'Derniere mise a jour :',
  'Jurisdiction:': 'Juridiction :',
  'Contact': 'Contact',
  'More policies': 'Autres politiques',
  'Terms': 'Conditions',
  'Privacy': 'Confidentialite',
  'Cookies': 'Cookies',
  'Refunds': 'Remboursements',
  'Prohibited Items': 'Articles interdits',
  'Account Deletion': 'Suppression du compte',
  'AuraDime Marketplace Terms of Service': 'Conditions d’utilisation du marketplace AuraDime',
  'The rules for using AuraDime as a customer, vendor, or logistics partner.': 'Les regles d’utilisation d’AuraDime pour les clients, vendeurs et partenaires logistiques.',
  'AuraDime Privacy Policy': 'Politique de confidentialite AuraDime',
  'How AuraDime collects, uses, shares, protects, and retains user data.': 'Comment AuraDime collecte, utilise, partage, protege et conserve les donnees des utilisateurs.',
  'AuraDime Cookie Policy': 'Politique de cookies AuraDime',
  'How AuraDime uses cookies, local storage, and app storage for login, cart, security, and preferences.': 'Comment AuraDime utilise les cookies, le stockage local et le stockage de l’application pour la connexion, le panier, la securite et les preferences.',
  'AuraDime Refund and Cancellation Policy': 'Politique de remboursement et d’annulation AuraDime',
  'How paid orders, unpaid orders, escrow releases, failed payments, and refunds are handled.': 'Comment sont geres les commandes payees, non payees, les liberations de sequestre, les paiements echoues et les remboursements.',
  'AuraDime Vendor Policy': 'Politique vendeur AuraDime',
  'Rules for stores, listings, pricing, fulfillment, KYC, payouts, and vendor conduct.': 'Regles concernant les boutiques, annonces, prix, execution, KYC, paiements et conduite des vendeurs.',
  'AuraDime Logistics Partner Policy': 'Politique partenaire logistique AuraDime',
  'Rules for delivery partners, service zones, shipment updates, proof of delivery, and payouts.': 'Regles pour les partenaires de livraison, zones de service, mises a jour d’expedition, preuves de livraison et paiements.',
  'AuraDime Prohibited Items Policy': 'Politique des articles interdits AuraDime',
  'Products and services that cannot be listed, bought, or promoted on AuraDime.': 'Produits et services qui ne peuvent pas etre listes, achetes ou promus sur AuraDime.',
  'AuraDime Dispute and Escrow Policy': 'Politique de litiges et de sequestre AuraDime',
  'How AuraDime reviews order disputes, delivery issues, evidence, refunds, and escrow releases.': 'Comment AuraDime examine les litiges de commande, problemes de livraison, preuves, remboursements et liberations de sequestre.',
  'AuraDime Account Deletion Policy': 'Politique de suppression de compte AuraDime',
  'What happens when a user permanently deletes an AuraDime account.': 'Ce qui se passe lorsqu’un utilisateur supprime definitivement son compte AuraDime.',
  '1. Introduction': '1. Introduction',
  '2. Eligibility': '2. Eligibilite',
  '3. AuraDime role as a marketplace': '3. Role d’AuraDime comme marketplace',
  '4. User accounts and sessions': '4. Comptes utilisateurs et sessions',
  '5. Customer terms': '5. Conditions clients',
  '6. Vendor terms': '6. Conditions vendeurs',
  '7. Logistics partner terms': '7. Conditions partenaires logistiques',
  '8. Payments, wallet, escrow, and withdrawals': '8. Paiements, wallet, sequestre et retraits',
  '9. Prohibited conduct': '9. Conduite interdite',
  '10. Disputes and admin decisions': '10. Litiges et decisions admin',
  '11. Suspension and termination': '11. Suspension et resiliation',
  '12. Liability': '12. Responsabilite',
  '13. Governing law': '13. Droit applicable',
  '14. Changes': '14. Modifications',
  '1. Data we collect': '1. Donnees collectees',
  '2. How we use data': '2. Utilisation des donnees',
  '3. Data sharing': '3. Partage des donnees',
  '4. Storage and security': '4. Stockage et securite',
  '5. Retention': '5. Conservation',
  '6. Your rights': '6. Vos droits',
  '7. Children': '7. Enfants',
  '8. International transfers': '8. Transferts internationaux',
  '1. What cookies are': '1. Que sont les cookies',
  '2. Storage we use': '2. Stockage utilise',
  '3. Your choices': '3. Vos choix',
  '1. Paid order cancellation': '1. Annulation d’une commande payee',
  '2. Unpaid and failed orders': '2. Commandes non payees et echouees',
  '3. Refund eligibility': '3. Conditions de remboursement',
  '4. Non-refundable situations': '4. Situations non remboursables',
  '5. Processing': '5. Traitement',
  '1. Vendor verification': '1. Verification vendeur',
  '2. Listings and pricing': '2. Annonces et prix',
  '3. Fulfillment': '3. Execution',
  '4. Wallet and payouts': '4. Wallet et paiements',
  '5. Store standards': '5. Standards boutique',
  '1. Verification and service zones': '1. Verification et zones de service',
  '2. Shipment handling': '2. Gestion des expeditions',
  '3. Failed delivery': '3. Livraison echouee',
  '4. Payouts and conduct': '4. Paiements et conduite',
  '1. Prohibited products': '1. Produits interdits',
  '2. Restricted products': '2. Produits restreints',
  '3. Enforcement': '3. Application',
  '1. When disputes can be raised': '1. Quand ouvrir un litige',
  '2. Escrow': '2. Sequestre',
  '3. Evidence': '3. Preuves',
  '4. Admin outcomes': '4. Decisions admin',
  '5. Appeals': '5. Appels',
  '1. Permanent deletion': '1. Suppression definitive',
  '2. What is deleted or disabled': '2. Ce qui est supprime ou desactive',
  '3. What may be retained': '3. Ce qui peut etre conserve',
  '4. Wallet and pending orders': '4. Wallet et commandes en attente',
  '5. Reviews and public content': '5. Avis et contenu public',
  'Identity': 'Identite',
  'Address': 'Adresse',
  'Communications': 'Communications',
  'Technical': 'Technique',
  'Usage': 'Utilisation',
  'Strictly necessary': 'Strictement necessaire',
  'Functional': 'Fonctionnel',
  'Analytics and performance': 'Analyses et performance',
  'Offline app data': 'Donnees hors ligne',
  'Push notifications': 'Notifications push',
  'This page is operational policy information for AuraDime and is not a substitute for legal advice. A qualified Cameroon lawyer should review the final published policies for regulatory completeness.': 'Cette page fournit des informations de politique operationnelle pour AuraDime et ne remplace pas un avis juridique. Un avocat qualifie au Cameroun doit relire les politiques finales publiees pour verifier leur conformite.',
};

const NOTIFICATION_TEXT_TRANSLATIONS_FR = {
  'Order placed': 'Commande passee',
  'Order updated': 'Commande mise a jour',
  'Order Confirmed': 'Commande confirmee',
  'Order Payment Confirmed': 'Paiement de commande confirme',
  'Order Paid & Confirmed': 'Commande payee et confirmee',
  'New Order Received': 'Nouvelle commande recue',
  'New Shipment Assigned': 'Nouvelle expedition assignee',
  'Payment failed': 'Paiement echoue',
  'Payment Confirmed': 'Paiement confirme',
  'Wallet Credited': 'Wallet credite',
  'Withdrawal Request Submitted': 'Demande de retrait envoyee',
  'Withdrawal Successful': 'Retrait reussi',
  'Withdrawal Failed': 'Retrait echoue',
  'Withdrawal Request Rejected': 'Demande de retrait rejetee',
  'Payout Failed': 'Paiement echoue',
  'Funds Released': 'Fonds liberes',
  'Order Completed': 'Commande terminee',
  'Order Cancelled': 'Commande annulee',
  'Order Cancelled & Refunded': 'Commande annulee et remboursee',
  'Shipment Update': 'Mise a jour expedition',
  'Your order has been delivered': 'Votre commande a ete livree',
  'Package Delivered': 'Colis livre',
  'Dispute Raised': 'Litige ouvert',
  'Verification Required': 'Verification requise',
  'Identity Verified': 'Identite verifiee',
  'KYC Rejected': 'KYC rejete',
  'New Product Question': 'Nouvelle question produit',
  'Question Answered': 'Question repondue',
  'New Status Reaction ❤️': 'Nouvelle reaction au statut ❤️',
};

const AUTO_TEXT_TRANSLATIONS_FR = {
  ...LEGAL_TEXT_TRANSLATIONS_FR,
  ...NOTIFICATION_TEXT_TRANSLATIONS_FR,
  'Dashboard': 'Tableau de bord',
  'Marketplace': 'Marche',
  'Users': 'Utilisateurs',
  'Vendors': 'Vendeurs',
  'Products': 'Produits',
  'Orders': 'Commandes',
  'Messages': 'Messages',
  'System Comms': 'Communications systeme',
  'Vendor KYC': 'KYC vendeur',
  'Disputes': 'Litiges',
  'Escrow & Fees': 'Escrow et frais',
  'Withdrawals': 'Retraits',
  'Transactions': 'Transactions',
  'Shipment Node': 'Expedition',
  'Logistics Earnings': 'Revenus logistiques',
  'Analytics': 'Analyses',
  'Categories': 'Categories',
  'Reviews': 'Avis',
  'Email Logs': 'Journaux e-mail',
  'Audit Ledger': 'Journal audit',
  'CMS / Hero': 'CMS / Hero',
  'Aura Stories': 'Stories',
  'Client Ratings': 'Avis clients',
  'Wallet': 'Wallet',
  'Wishlist': 'Favoris',
  'Profile': 'Profil',
  'Security': 'Securite',
  'Network': 'Reseau',
  'Verification': 'Verification',
  'Alerts': 'Alertes',
  'Signals': 'Signaux',
  'Account Configuration': 'Configuration du compte',
  'Admin Access': 'Acces admin',
  'Vendor Premium': 'Vendeur premium',
  'Fulfillment Node': 'Centre logistique',
  'Aura Member': 'Membre Aura',
  'Standard Tier': 'Niveau standard',
  'Pro Vendor': 'Vendeur pro',
  'Logistics Ops': 'Operations logistiques',
  'Governance Mode': 'Mode gouvernance',
  'Store Active': 'Boutique active',
  'Active': 'Actif',
  'Pending': 'En attente',
  'Completed': 'Termine',
  'Failed': 'Echoue',
  'Cancelled': 'Annule',
  'Refunded': 'Rembourse',
  'Processing': 'En traitement',
  'Shipped': 'Expedie',
  'Delivered': 'Livre',
  'Paid': 'Paye',
  'Unpaid': 'Non paye',
  'All': 'Tout',
  'Search': 'Rechercher',
  'Refresh': 'Actualiser',
  'Filter': 'Filtrer',
  'Filters': 'Filtres',
  'Export': 'Exporter',
  'Edit': 'Modifier',
  'Delete': 'Supprimer',
  'Save': 'Enregistrer',
  'Cancel': 'Annuler',
  'Approve': 'Approuver',
  'Disapprove': 'Refuser',
  'Suspend': 'Suspendre',
  'View': 'Voir',
  'Details': 'Details',
  'Status': 'Statut',
  'Action': 'Action',
  'Actions': 'Actions',
  'Name': 'Nom',
  'Email': 'E-mail',
  'Phone': 'Telephone',
  'Role': 'Role',
  'Customer': 'Client',
  'Vendor': 'Vendeur',
  'Logistics': 'Logistique',
  'Admin': 'Admin',
  'Amount': 'Montant',
  'Total': 'Total',
  'Subtotal': 'Sous-total',
  'Balance': 'Solde',
  'Wallet balance': 'Solde wallet',
  'Revenue': 'Revenu',
  'Net sales': 'Ventes nettes',
  'Open orders': 'Commandes ouvertes',
  'Inventory': 'Inventaire',
  'Live': 'En direct',
  'Recent Activity': 'Activite recente',
  'Recent Orders': 'Commandes recentes',
  'Sales Growth': 'Croissance ventes',
  'Monthly revenue trends': 'Tendances mensuelles',
  'Live analysis': 'Analyse en direct',
  'No Activity': 'Aucune activite',
  'No orders yet': 'Aucune commande',
  'Product': 'Produit',
  'Order ID': 'ID commande',
  'Customer': 'Client',
  'Action': 'Action',
  'Add Product': 'Ajouter produit',
  'Launch Story': 'Publier story',
  'Store Info': 'Info boutique',
  'Find anything...': 'Rechercher...',
  'Manifests': 'Manifestes',
  'Route Pricing': 'Tarifs routes',
  'Live Tracking': 'Suivi en direct',
  'Relay Nodes': 'Noeuds relais',
  'Total Platform Volume': 'Volume total plateforme',
  'Platform Volume': 'Volume plateforme',
  'Verification Watch': 'Verification en attente',
  'Escrow Flow': 'Flux escrow',
  'Core Stability': 'Stabilite systeme',
  'Platform Uptime': 'Disponibilite plateforme',
  'Access Firewall': 'Pare-feu acces',
  'Authorization Layer': 'Couche autorisation',
  'Commission Controls': 'Controle commissions',
  'Admin Commission': 'Commission admin',
  'Escrow Commission': 'Commission escrow',
  'Percentage': 'Pourcentage',
  'Save Fees': 'Enregistrer frais',
  'Order history': 'Historique commandes',
  'Transaction data': 'Donnees transaction',
  'Transaction account': 'Compte transaction',
  'Money route': 'Route argent',
  'Linked order': 'Commande liee',
  'Order total': 'Total commande',
  'Payment': 'Paiement',
  'Shipping': 'Livraison',
  'Tracking': 'Suivi',
  'Vendor store': 'Boutique vendeur',
  'Update status': 'Modifier statut',
  'Reference': 'Reference',
  'Gateway': 'Passerelle',
  'Gateway ID': 'ID passerelle',
  'Type': 'Type',
  'Created': 'Cree',
  'Search users...': 'Rechercher utilisateurs...',
  'Search products...': 'Rechercher produits...',
  'Search orders...': 'Rechercher commandes...',
  'Search vendors...': 'Rechercher vendeurs...',
  'Search transactions...': 'Rechercher transactions...',
  'Search withdrawals...': 'Rechercher retraits...',
  'Select all': 'Tout selectionner',
  'Batch delete': 'Suppression groupee',
  'Table view': 'Vue tableau',
  'Grid view': 'Vue grille',
};

const AUTO_ATTRIBUTE_TRANSLATIONS_FR = {
  ...AUTO_TEXT_TRANSLATIONS_FR,
  'Search products and stores': 'Rechercher produits et boutiques',
  'Search premium products...': 'Rechercher produits premium...',
  'Search by order ID or product': 'Rechercher par commande ou produit',
  'Find anything...': 'Rechercher...',
  'Search users...': 'Rechercher utilisateurs...',
  'Search products...': 'Rechercher produits...',
  'Search orders...': 'Rechercher commandes...',
  'Search vendors...': 'Rechercher vendeurs...',
  'Search transactions...': 'Rechercher transactions...',
  'Search withdrawals...': 'Rechercher retraits...',
  'Messages': 'Messages',
  'Wallet balance': 'Solde wallet',
};

const shouldTranslateNodeParent = (parent) => {
  if (!parent || parent.nodeType !== 1) return false;
  const tag = parent.tagName?.toLowerCase();
  return !['script', 'style', 'textarea', 'code', 'pre', 'noscript'].includes(tag);
};

const preserveOuterSpacing = (text, translated) => {
  const leading = text.match(/^\s*/)?.[0] || '';
  const trailing = text.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
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
      document.cookie = `${STORAGE_KEY}=${language}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const textMap = language === 'fr' ? AUTO_TEXT_TRANSLATIONS_FR : null;
    const attributeMap = language === 'fr' ? AUTO_ATTRIBUTE_TRANSLATIONS_FR : null;
    let frame = null;

    const translateTextNode = (node) => {
      if (!shouldTranslateNodeParent(node.parentElement)) return;
      const original = node.__auraOriginalText || node.nodeValue;
      if (!node.__auraOriginalText) node.__auraOriginalText = original;

      if (!textMap) {
        if (node.nodeValue !== original) node.nodeValue = original;
        return;
      }

      const key = String(original || '').trim();
      const translated = textMap[key];
      if (translated) node.nodeValue = preserveOuterSpacing(original, translated);
    };

    const translateAttributes = (element) => {
      if (!element || element.nodeType !== 1) return;

      ['placeholder', 'title', 'aria-label'].forEach((attribute) => {
        if (!element.hasAttribute(attribute)) return;
        const originalAttribute = `data-aura-original-${attribute}`;
        const original = element.getAttribute(originalAttribute) || element.getAttribute(attribute);
        if (!element.hasAttribute(originalAttribute)) {
          element.setAttribute(originalAttribute, original);
        }

        if (!attributeMap) {
          if (element.getAttribute(attribute) !== original) element.setAttribute(attribute, original);
          return;
        }

        const translated = attributeMap[String(original || '').trim()];
        if (translated) element.setAttribute(attribute, translated);
      });
    };

    const scan = (root = document.body) => {
      if (!root) return;
      if (root.nodeType === Node.TEXT_NODE) {
        translateTextNode(root);
        return;
      }

      if (root.nodeType === Node.ELEMENT_NODE) {
        translateAttributes(root);
      }

      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        {
          acceptNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
              return node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );

      let current = walker.currentNode;
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) {
          translateTextNode(current);
        } else if (current.nodeType === Node.ELEMENT_NODE) {
          translateAttributes(current);
        }
        current = walker.nextNode();
      }
    };

    const scheduleScan = (root) => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        scan(root || document.body);
        frame = null;
      });
    };

    scheduleScan(document.body);

    const observer = new MutationObserver((mutations) => {
      const root = mutations.find((mutation) => mutation.target)?.target || document.body;
      scheduleScan(root.nodeType === Node.ELEMENT_NODE ? root : root.parentElement);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
    });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
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
        document.cookie = `${STORAGE_KEY}=${normalized}; path=/; max-age=31536000; SameSite=Lax`;
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
