/**
 * utils/roles.js
 * Auradime — Frontend role helpers
 */

export const isAdminOrManager = (role) => ['admin', 'manager'].includes(role);
export const isAdminOnly = (role) => role === 'admin';
