/** API spec minimum for admin passwords created by superadmin. */
export function validateAdminPassword(password: string): string | null {
  if (!password || String(password).length < 6) {
    return 'Password must be at least 6 characters long';
  }
  return null;
}

/** Stricter rules for superadmin bootstrap / optional hardening. */
export function validatePasswordStrength(password: string): string | null {
  const base = validateAdminPassword(password);
  if (base) return base;
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return 'Password must contain at least one letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
}
