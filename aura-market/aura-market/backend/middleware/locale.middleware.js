/**
 * middleware/locale.middleware.js
 * Detects the user's preferred language from headers or user profile.
 */
const setLocale = (req, res, next) => {
  // 1. Check User Profile if logged in
  if (req.user && req.user.preferred_language) {
    req.locale = req.user.preferred_language;
  } 
  // 2. Check Accept-Language header
  else if (req.headers['accept-language']) {
    const lang = req.headers['accept-language'].split(',')[0].split('-')[0];
    const supported = ['en', 'fr', 'sw', 'ha'];
    req.locale = supported.includes(lang) ? lang : 'en';
  } 
  // 3. Fallback to default
  else {
    req.locale = 'en';
  }

  // Set response header for client to know what locale is being used
  res.setHeader('Content-Language', req.locale);
  next();
};

module.exports = setLocale;
