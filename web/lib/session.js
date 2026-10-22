/**
 * Does this API error mean the user is no longer signed in?
 *
 * One definition shared by the auth store and the API client. A 401 ends the
 * session only when the server says the session itself is gone — missing,
 * invalid, expired or revoked token, deleted user — or a 403 for a
 * deactivated account. Other 401s ("Current password is incorrect", a wrong
 * login or 2FA code) and network failures / 5xx keep the user signed in.
 */
const SESSION_GONE_401 = [
  'no token provided',               // auth middleware: token missing
  'token no longer exists',          // user deleted
  'session is no longer valid',      // token revoked (tokenVersion bump)
  'invalid token',                   // JsonWebTokenError
  'session has expired',             // TokenExpiredError (server wording)
  'jwt expired',                     // raw library wording
  'authentication required',         // controller guards with no user
];

export const isSessionEnded = (err) => {
  const status = err?.response?.status;
  const message = String(err?.response?.data?.message || '').toLowerCase();
  if (status === 401) return SESSION_GONE_401.some((m) => message.includes(m));
  return status === 403 && message.includes('deactivated');
};

/** Same rule for code that only has the status and message. */
export const isSessionEndedResponse = (status, message) =>
  isSessionEnded({ response: { status, data: { message } } });
