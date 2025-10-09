import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RefreshCw, Upload, Loader2, ChevronDown } from "lucide-react";

interface InventoryHeaderProps {
  itemCount: number;
  hasUnsyncedChanges: boolean;
  syncStatusText: string | null;
  onRefresh: () => void;
  onPushChanges: () => void;
  isRefreshing: boolean;
  isPushing: boolean;
  isLoading: boolean;
  currentFilter: string;
  onFilterChange: (filter: string) => void;
}

export function InventoryHeader({
  itemCount,
  hasUnsyncedChanges,
  syncStatusText,
  onRefresh,
  onPushChanges,
  isRefreshing,
  isPushing,
  isLoading,
  currentFilter,
  onFilterChange
}: InventoryHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h2 className="text-xl font-semibold text-gray-900">Live Inventory Data</h2>
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-gray-600" data-testid="button-filter">
              {currentFilter === "all" ? "All" : 
               currentFilter === "printer-epson" ? "Printer (Epson)" : 
               currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1)} 
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onFilterChange("all")} data-testid="filter-all">
              All Items
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange("desktop")} data-testid="filter-desktop">
              Desktop
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange("monitor")} data-testid="filter-monitor">
              Monitor
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange("laptop")} data-testid="filter-laptop">
              Laptop
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange("tablet")} data-testid="filter-tablet">
              Tablet
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange("printer")} data-testid="filter-printer">
              Printer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange("printer-epson")} data-testid="filter-printer-epson">
              Printer (Epson)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <span className="text-sm text-gray-500">({itemCount} Items)</span>
        
        <div className="flex items-center gap-2 text-sm">
          {hasUnsyncedChanges && (
            <span className="text-orange-600 font-medium" data-testid="status-unsaved">
              Unsaved changes
            </span>
          )}
          {syncStatusText && (
            <span className="text-gray-500" data-testid="text-last-sync-mins">
              {syncStatusText}
            </span>
          )}
        </div>
        
        <Button 
          onClick={onRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          data-testid="button-refresh"
        >
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
        
        <Button 
          onClick={onPushChanges} 
          disabled={isLoading || !hasUnsyncedChanges}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          size="sm"
          data-testid="button-sync-now"
        >
          {isPushing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          Sync Now
        </Button>
      </div>
    </div>
  );
}