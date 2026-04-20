const rateLimit = require('express-rate-limit');

/**
 * General API Limiter
 * Applied to all routes to prevent broad abuse.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1200, // Limit each IP to 1200 requests per windowMs (Higher for development/browsing)
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Strict Limiter for Auth & Wallet
 * Prevents brute force on login/register and rapid wallet operations.
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Reduced to 15 minutes for development flexibility
  max: 300, // Significantly increased from 10 to 300 for developer node testing
  message: {
    success: false,
    message: 'Security Alert: Temporary rate limit reached. Please wait a few moments.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Public limiter for high-traffic public endpoints (e.g., vendor listings)
 * Allows a much larger burst for endpoints intended to be publicly scraped/browsed.
 */
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Allow larger number of requests for public endpoints
  message: {
    success: false,
    message: 'Too many requests to public endpoint. Please try again shortly.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  strictLimiter,
  publicLimiter,
};
