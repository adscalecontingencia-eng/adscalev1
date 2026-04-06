/**
 * Parse a YYYY-MM-DD date string without timezone shift.
 * Using T12:00:00 ensures the date stays correct in any timezone.
 */
export function parseDateLocal(dateStr: string): Date {
  if (!dateStr) return new Date();
  // If it's already a full ISO string with time, just parse it
  if (dateStr.includes('T')) {
    const parts = dateStr.split('T')[0].split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
  }
  const parts = dateStr.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
}

/**
 * Format a YYYY-MM-DD string to dd/MM/yyyy without timezone issues.
 */
export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const [y, m, d] = clean.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Format a YYYY-MM-DD string to dd/MM without timezone issues.
 */
export function formatDateShortBR(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const [, m, d] = clean.split('-');
  return `${d}/${m}`;
}
