"use client";

import LoginPage from '../login/page';

/**
 * RegisterPage
 * Now redirecting to the unified Auth hub for a seamless WhatsApp-style flow.
 * We reuse the LoginPage component which now contains the UnifiedAuth logic.
 */
export default function RegisterPage() {
  return <LoginPage />;
}
