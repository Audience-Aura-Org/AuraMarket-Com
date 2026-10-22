import { describe, it, expect } from 'vitest';
import { isSessionEnded } from './session';

const res = (status, message) => ({ response: { status, data: { message } } });

describe('isSessionEnded — every server response that means "you are not signed in"', () => {
  it.each([
    ['token missing', res(401, 'Access denied. No token provided.')],
    ['token expired (server wording)', res(401, 'Your session has expired. Please log in again.')],
    ['token invalid', res(401, 'Invalid token. Please log in again.')],
    ['user deleted', res(401, 'The user belonging to this token no longer exists.')],
    ['token revoked', res(401, 'This session is no longer valid.')],
    ['jwt library wording', res(401, 'jwt expired')],
    ['controller guard', res(401, 'Authentication required')],
    ['account deactivated', res(403, 'Your account has been deactivated.')],
  ])('%s → ended', (_label, err) => {
    expect(isSessionEnded(err)).toBe(true);
  });

  it.each([
    ['network failure (no response)', { message: 'Network Error' }],
    ['server error', res(500, 'Internal Server Error')],
    ['forbidden for this role', res(403, 'You do not have permission to perform this action.')],
    ['unverified write', res(403, 'Please verify your email first.')],
    // 401s that are NOT about the session — a signed-in user must stay signed in.
    ['wrong current password', res(401, 'Current password is incorrect.')],
    ['wrong login password', res(401, 'Invalid email or password.')],
    ['wrong 2FA code', res(401, 'Invalid 2FA token.')],
  ])('%s → NOT ended (keep the session)', (_label, err) => {
    expect(isSessionEnded(err)).toBe(false);
  });
});
