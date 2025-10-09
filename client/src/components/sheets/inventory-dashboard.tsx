import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, ExternalLink, Plus, Loader2 } from "lucide-react";
import { SheetsService, GoogleSheet } from "../../services/sheets-service";
import { useToast } from "@/hooks/use-toast";

export function InventoryDashboard() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [currentSheet, setCurrentSheet] = useState<GoogleSheet | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sheets = [] } = useQuery({
    queryKey: ["sheets"],
    queryFn: SheetsService.getUserSheets,
  });

  const { data: sheetData = [], isLoading: dataLoading, refetch: refetchData } = useQuery({
    queryKey: ["sheets", currentSheet?.id, "data"],
    queryFn: () => currentSheet ? SheetsService.getSheetData(currentSheet.id) : [],
    enabled: !!currentSheet,
  });

  const addSheetMutation = useMutation({
    mutationFn: SheetsService.addSheet,
    onSuccess: (data) => {
      setCurrentSheet(data.sheet);
      setSheetUrl("");
      toast({
        title: "Sheet added",
        description: "Google Sheet connected successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["sheets"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncDataMutation = useMutation({
    mutationFn: SheetsService.syncSheetData,
    onSuccess: () => {
      toast({
        title: "Data synced",
        description: "Inventory updated from Google Sheets",
      });
      refetchData();
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-select the latest sheet
  useEffect(() => {
    if (sheets.length > 0 && !currentSheet) {
      setCurrentSheet(sheets[0]);
    }
  }, [sheets, currentSheet]);

  const handleAddSheet = () => {
    if (!sheetUrl.trim()) return;
    addSheetMutation.mutate(sheetUrl.trim());
  };

  const handleSync = () => {
    if (!currentSheet) return;
    syncDataMutation.mutate(currentSheet.id);
  };

  const isLoading = addSheetMutation.isPending || syncDataMutation.isPending || dataLoading;

  // If no sheets exist, show add sheet interface
  if (sheets.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-16">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Inventory Management</CardTitle>
            <p className="text-muted-foreground">
              Connect your Google Sheets inventory to get started
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Paste Google Sheets URL or ID..."
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSheet()}
                className="flex-1"
              />
              <Button 
                onClick={handleAddSheet} 
                disabled={!sheetUrl.trim() || isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Connect Sheet
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Make sure the Google Sheet is shared with view access or is public
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show full screen inventory
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Inventory</h1>
          {currentSheet && (
            <a 
              href={currentSheet.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <Input
              placeholder="Add another sheet..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSheet()}
              className="w-64"
            />
            <Button 
              onClick={handleAddSheet} 
              disabled={!sheetUrl.trim() || isLoading}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
          <Button 
            onClick={handleSync} 
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Sync
          </Button>
        </div>
      </div>

      {currentSheet && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{currentSheet.title}</CardTitle>
              <div className="text-sm text-muted-foreground">
                {sheetData.length} row{sheetData.length !== 1 ? 's' : ''}
                {currentSheet.lastSyncAt && (
                  <span className="ml-2">
                    • Last synced: {new Date(currentSheet.lastSyncAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : sheetData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-2">No data found</p>
                <p>Click sync to load data from your Google Sheet</p>
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                      {Object.keys(sheetData[0] || {}).filter(key => key !== '_rowIndex').sort().map(col => (
                        <th key={col} className="text-left p-3 font-medium text-muted-foreground">
                          Column {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheetData.map((row, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-medium">{index + 1}</td>
                        {Object.keys(sheetData[0] || {}).filter(key => key !== '_rowIndex').sort().map(col => (
                          <td key={col} className="p-3">
                            {String(row[col] || '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}