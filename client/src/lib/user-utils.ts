import { format } from "date-fns";

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map(word => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatLastSignIn(lastSignIn?: string): string {
  if (!lastSignIn) return "Never";
  
  const date = new Date(lastSignIn);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  
  return format(date, "MMM d, yyyy");
}

export function formatDate(dateString: string): string {
  return format(new Date(dateString), "MMMM d, yyyy");
}

export function formatShortDate(dateString: string): string {
  return format(new Date(dateString), "MMM d, yyyy");
}

export function formatDateTime(dateString: string): string {
  return format(new Date(dateString), "MMM d, yyyy 'at' h:mm a");
}