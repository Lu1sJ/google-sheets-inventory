/**
 * Formats the current date in MM/DD/YYYY format using America/New_York (EST/EDT) timezone.
 * This ensures consistent date formatting regardless of the server's timezone.
 */
export function formatLastVerifiedDate(): string {
  const now = new Date();
  
  // Use Intl.DateTimeFormat to get the date in America/New_York timezone
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
  
  return `${month}/${day}/${year}`;
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
