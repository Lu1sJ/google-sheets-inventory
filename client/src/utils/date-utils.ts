/**
 * Formats the current date in MM/DD/YYYY format using America/New_York (EST/EDT) timezone.
 * This ensures consistent date formatting regardless of the user's browser or server timezone.
 * Example output: 10/2/2025 (with full 4-digit year)
 */
export function formatLastVerifiedDate(): string {
  const now = new Date();
  
  // Get date components in America/New_York timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  
  const parts = formatter.formatToParts(now);
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';
  
  // Ensure year is always 4 digits (e.g., "2025" not "25")
  const fullYear = year.length === 2 ? `20${year}` : year;
  
  return `${month}/${day}/${fullYear}`;
}

/**
 * Gets the current year in America/New_York (EST/EDT) timezone.
 * Used for description text generation.
 */
export function getCurrentYearEST(): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric'
  });
  
  return parseInt(formatter.format(new Date()), 10);
}
