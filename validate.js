/**
 * Input validation & XSS sanitization utilities.
 * All database queries also use parameterized placeholders against SQL injection.
 */
export function sanitizeText(value, maxLength = 1000) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function clampInt(value, min, max, fallback = min) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

export function requireFields(body, fields) {
  const missing = [];
  for (const field of fields) {
    const val = body?.[field];
    if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
      missing.push(field);
    }
  }
  return missing;
}
