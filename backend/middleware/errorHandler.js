const logger = require('../utils/logger');

const ERROR_TRANSLATIONS_FR = {
  'Internal Server Error': 'Erreur interne du serveur',
  'Invalid token. Please log in again.': 'Jeton invalide. Veuillez vous reconnecter.',
  'Your session has expired. Please log in again.': 'Votre session a expire. Veuillez vous reconnecter.',
  'Please provide a valid email address.': 'Veuillez fournir une adresse e-mail valide.',
  'Please provide a valid email address and 6-digit code.': 'Veuillez fournir une adresse e-mail valide et un code a 6 chiffres.',
  'Type DELETE or SUPPRIMER to permanently delete your account.': 'Tapez DELETE ou SUPPRIMER pour supprimer definitivement votre compte.',
  'Verification is required before this action can be completed.': 'Une verification est requise avant d’effectuer cette action.',
  'Phone number is required for mobile money payment.': 'Le numero de telephone est obligatoire pour un paiement mobile money.',
  'Currency is required.': 'La devise est obligatoire.',
  'Phone number is required for Mobile Money withdrawal.': 'Le numero de telephone est obligatoire pour un retrait Mobile Money.',
  'Bank code and account number are required for bank withdrawal.': 'Le code banque et le numero de compte sont obligatoires pour un retrait bancaire.',
  'A rejection reason (min 5 characters) is required.': 'Un motif de rejet est obligatoire (5 caracteres minimum).',
  'Reason for failure is required.': 'Le motif de l’echec est obligatoire.',
  'Vendor access required.': 'Acces vendeur requis.',
  'This order has already moved into fulfilment and cannot be cancelled here.': 'Cette commande est deja en cours d’execution et ne peut plus etre annulee ici.',
  'Paid orders can only be cancelled within 30 minutes of checkout.': 'Les commandes payees ne peuvent etre annulees que dans les 30 minutes apres le paiement.',
};

const resolveLanguage = (req) => {
  const userLanguage = req.user?.preferred_language;
  if (userLanguage === 'fr') return 'fr';
  const headerLanguage = String(req.headers['accept-language'] || '').toLowerCase();
  return headerLanguage.startsWith('fr') || headerLanguage.includes('fr-') ? 'fr' : 'en';
};

const translateErrorMessage = (message, language) => {
  if (language !== 'fr' || !message) return message;
  const text = String(message);
  if (ERROR_TRANSLATIONS_FR[text]) return ERROR_TRANSLATIONS_FR[text];
  if (text.startsWith('Invalid ')) return text.replace('Invalid ', 'Invalide ');
  if (text.startsWith('An account with this ') && text.endsWith(' already exists.')) {
    return 'Un compte avec cette information existe deja.';
  }
  if (text.includes('is required')) return text.replace(' is required', ' est obligatoire');
  return text;
};

const errorHandler = (err, req, res, next) => {
  // Log error using structured logger
  logger.error(`${err.name}: ${err.message}`, { 
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    user: req.user ? req.user._id : 'anonymous'
  });

  // Determine HTTP status code
  let statusCode = err.statusCode || 500;

  // Handle specific Mongoose errors
  if (err.name === 'CastError') {
    statusCode = 400;
    err.message = `Invalid ${err.path}: ${err.value}`;
  }

  if (err.code === 11000) {
    // Duplicate field value (e.g., duplicate email)
    const field = Object.keys(err.keyValue)[0];
    statusCode = 400;
    err.message = `An account with this ${field} already exists.`;
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    err.message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    err.message = 'Invalid token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    err.message = 'Your session has expired. Please log in again.';
  }

  const language = resolveLanguage(req);
  const localizedMessage = translateErrorMessage(err.message || 'Internal Server Error', language);

  res.status(statusCode).json({
    success: false,
    message: localizedMessage,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
