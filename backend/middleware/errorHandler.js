const logger = require('../utils/logger');
const { sendEmail } = require('../utils/emailService');

const ERROR_TRANSLATIONS_FR = {
  'Internal Server Error': 'Erreur interne du serveur',
  'Invalid token. Please log in again.': 'Jeton invalide. Veuillez vous reconnecter.',
  'Your session has expired. Please log in again.': 'Votre session a expire. Veuillez vous reconnecter.',
  'Please provide a valid email address.': 'Veuillez fournir une adresse e-mail valide.',
  'Please provide a valid email address and 6-digit code.': 'Veuillez fournir une adresse e-mail valide et un code a 6 chiffres.',
  'Type DELETE or SUPPRIMER to permanently delete your account.': 'Tapez DELETE ou SUPPRIMER pour supprimer definitivement votre compte.',
  'Verification is required before this action can be completed.': 'Une verification est requise avant d\'effectuer cette action.',
  'Phone number is required for mobile money payment.': 'Le numero de telephone est obligatoire pour un paiement mobile money.',
  'Currency is required.': 'La devise est obligatoire.',
  'Phone number is required for Mobile Money withdrawal.': 'Le numero de telephone est obligatoire pour un retrait Mobile Money.',
  'Bank code and account number are required for bank withdrawal.': 'Le code banque et le numero de compte sont obligatoires pour un retrait bancaire.',
  'A rejection reason (min 5 characters) is required.': 'Un motif de rejet est obligatoire (5 caracteres minimum).',
  'Reason for failure is required.': 'Le motif de l\'echec est obligatoire.',
  'Vendor access required.': 'Acces vendeur requis.',
  'This order has already moved into fulfilment and cannot be cancelled here.': 'Cette commande est deja en cours d\'execution et ne peut plus etre annulee ici.',
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

// ── Rate-limited admin error email ──────────────────────────────────────────
// Tracks recent error fingerprints to avoid flooding admin inbox.
// At most 1 email per unique error fingerprint every 15 minutes.
const _recentErrors = new Map();
const ERROR_EMAIL_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

const ADMIN_ERROR_EMAIL = process.env.ADMIN_ERROR_EMAIL || process.env.EMAIL_USER || 'hello@auradime.com';

function notifyAdminOfError(err, req, statusCode) {
  // Only notify on genuine server errors (500+), not client errors
  if (statusCode < 500) return;

  const fingerprint = `${err.name}:${err.message}:${req.originalUrl}`;
  const now = Date.now();
  const lastSent = _recentErrors.get(fingerprint);
  if (lastSent && now - lastSent < ERROR_EMAIL_COOLDOWN_MS) return;
  _recentErrors.set(fingerprint, now);

  // Cleanup old entries every so often
  if (_recentErrors.size > 200) {
    for (const [key, ts] of _recentErrors) {
      if (now - ts > ERROR_EMAIL_COOLDOWN_MS) _recentErrors.delete(key);
    }
  }

  const timestamp = new Date().toISOString();
  const userId = req.user?._id || 'anonymous';
  const userEmail = req.user?.email || 'N/A';
  const stackTrace = (err.stack || '').substring(0, 2000);

  const html = `
    <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <h2 style="color: #dc2626; font-size: 16px; margin: 0 0 4px;">Server Error (${statusCode})</h2>
        <p style="color: #991b1b; font-size: 12px; margin: 0;">${timestamp}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 8px 0; color: #6b7280; width: 100px;">Error</td><td style="padding: 8px 0; font-weight: 600;">${err.name}: ${err.message}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Endpoint</td><td style="padding: 8px 0; font-weight: 600;">${req.method} ${req.originalUrl}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">User</td><td style="padding: 8px 0;">${userId} (${userEmail})</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">IP</td><td style="padding: 8px 0;">${req.ip || req.headers['x-forwarded-for'] || 'unknown'}</td></tr>
      </table>
      ${stackTrace ? `
        <div style="margin-top: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; overflow-x: auto;">
          <p style="font-size: 10px; color: #6b7280; margin: 0 0 8px; font-weight: 600;">STACK TRACE</p>
          <pre style="font-size: 11px; color: #334155; margin: 0; white-space: pre-wrap; word-break: break-all; font-family: monospace;">${stackTrace}</pre>
        </div>
      ` : ''}
      <p style="font-size: 11px; color: #94a3b8; margin-top: 20px; text-align: center;">Auradime Platform Error Monitor</p>
    </div>
  `;

  sendEmail({
    to: ADMIN_ERROR_EMAIL,
    subject: `[Auradime Error] ${statusCode} — ${req.method} ${req.originalUrl}`,
    html,
    text: `Server Error ${statusCode}\n\n${err.name}: ${err.message}\nEndpoint: ${req.method} ${req.originalUrl}\nUser: ${userId}\nTime: ${timestamp}\n\n${stackTrace}`,
  }).catch(() => {
    // Email send failure should never block the error handler
  });
}

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

  // Email admin for server errors (500+) — fire-and-forget, rate-limited
  notifyAdminOfError(err, req, statusCode);

  const language = resolveLanguage(req);
  const localizedMessage = translateErrorMessage(err.message || 'Internal Server Error', language);

  res.status(statusCode).json({
    success: false,
    message: localizedMessage,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
