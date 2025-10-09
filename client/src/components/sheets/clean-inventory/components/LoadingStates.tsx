import { Loader2 } from "lucide-react";

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );
}

export function EmptyDataState() {
  return (
    <div className="text-center py-20">
      <p className="text-xl text-gray-500 mb-4">No data found</p>
      <p className="text-gray-400">Connect a Google Sheet to get started</p>
    </div>
  );
}