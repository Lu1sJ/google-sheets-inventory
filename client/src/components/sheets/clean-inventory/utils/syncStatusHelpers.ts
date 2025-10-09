import { TIME_CONSTANTS } from '../constants';

export function calculateSyncStatusText(lastSyncAt?: string): string | null {
  if (!lastSyncAt) return null;
  
  const lastSyncTime = new Date(lastSyncAt).getTime();
  const now = Date.now();
  const timeDiffMs = now - lastSyncTime;
  
  if (timeDiffMs < TIME_CONSTANTS.ONE_MINUTE) {
    return "Synced just now";
  }
  
  if (timeDiffMs < TIME_CONSTANTS.ONE_HOUR) {
    const minutesAgo = Math.floor(timeDiffMs / TIME_CONSTANTS.ONE_MINUTE);
    return `Synced ${minutesAgo}m ago`;
  }
  
  if (timeDiffMs < TIME_CONSTANTS.ONE_DAY) {
    const hoursAgo = Math.floor(timeDiffMs / TIME_CONSTANTS.ONE_HOUR);
    return `Synced ${hoursAgo}h ago`;
  }
  
  const daysAgo = Math.floor(timeDiffMs / TIME_CONSTANTS.ONE_DAY);
  return `Synced ${daysAgo}d ago`;
}