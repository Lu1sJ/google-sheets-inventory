import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Settings, Loader2, Edit2, Check, X, Sparkles } from "lucide-react";
import { Link } from "@/lib/router";
import { ColumnMapping } from "./column-mapping";
import { SimpleDataView } from "./simple-data-view";
import { SheetsService, GoogleSheet, SheetMapping } from "../../services/sheets-service";
import { useToast } from "@/hooks/use-toast";
import { getSheetsQueryKey, getSheetMappingsQueryKey, getSheetDataQueryKey, getSheetQueryKey } from "../../constants/sheets";

export function SheetsDashboard() {
  const [selectedSheet, setSelectedSheet] = useState<GoogleSheet | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sheets = [], isLoading: sheetsLoading } = useQuery({
    queryKey: getSheetsQueryKey(),
    queryFn: SheetsService.getUserSheets,
  });

  const { data: mappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: selectedSheet ? getSheetMappingsQueryKey(selectedSheet.id) : ['sheets', 'none', 'mappings'],
    queryFn: () => selectedSheet ? SheetsService.getSheetMappings(selectedSheet.id) : [],
    enabled: !!selectedSheet,
  });

  const { data: sheetData = [], isLoading: dataLoading } = useQuery({
    queryKey: selectedSheet ? getSheetDataQueryKey(selectedSheet.id) : ['sheets', 'none', 'data'],
    queryFn: () => selectedSheet ? SheetsService.getSheetData(selectedSheet.id) : [],
    enabled: !!selectedSheet,
  });

  const updateSheetMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => 
      SheetsService.updateSheet(id, { title }),
    onMutate: async ({ id, title }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: getSheetsQueryKey() });
      
      // Snapshot the previous value
      const previousSheets = queryClient.getQueryData(getSheetsQueryKey());
      
      // Optimistically update the cache
      queryClient.setQueryData(getSheetsQueryKey(), (old: any) => 
        old?.map((sheet: any) => 
          sheet.id === id ? { ...sheet, title } : sheet
        ) || []
      );
      
      // Return rollback context
      return { previousSheets };
    },
    onSuccess: (updatedSheet) => {
      // Update cache with server response to ensure consistency
      queryClient.setQueryData(getSheetsQueryKey(), (old: any) => 
        old?.map((sheet: any) => 
          sheet.id === updatedSheet.id ? updatedSheet : sheet
        ) || []
      );
      
      toast({
        title: "Sheet updated",
        description: "Sheet name has been updated",
      });
      setEditingSheetId(null);
      setEditingName("");
    },
    onError: (error: Error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousSheets) {
        queryClient.setQueryData(getSheetsQueryKey(), context.previousSheets);
      }
      
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSheetMutation = useMutation({
    mutationFn: SheetsService.deleteSheet,
    onMutate: async (sheetId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: getSheetsQueryKey() });
      
      // Snapshot the previous value
      const previousSheets = queryClient.getQueryData(getSheetsQueryKey());
      
      // Optimistically remove the sheet from cache
      queryClient.setQueryData(getSheetsQueryKey(), (old: any) => 
        old?.filter((sheet: any) => sheet.id !== sheetId) || []
      );
      
      // Clear selected sheet if it's being deleted
      if (selectedSheet?.id === sheetId) {
        setSelectedSheet(null);
      }
      
      // Return rollback context
      return { previousSheets, wasSelected: selectedSheet?.id === sheetId };
    },
    onSuccess: (_, deletedSheetId) => {
      toast({
        title: "Sheet deleted",
        description: "Google Sheet has been removed",
      });
      
      // Clean up related queries
      queryClient.removeQueries({ queryKey: getSheetDataQueryKey(deletedSheetId) });
      queryClient.removeQueries({ queryKey: getSheetMappingsQueryKey(deletedSheetId) });
      queryClient.removeQueries({ queryKey: getSheetQueryKey(deletedSheetId) });
      
      // Automatically refresh the sheets list to update UI
      queryClient.invalidateQueries({ queryKey: getSheetsQueryKey() });
      
      // If there are remaining sheets and none is selected, auto-select the first one
      const remainingSheets = queryClient.getQueryData(getSheetsQueryKey()) as any[] || [];
      if (remainingSheets.length > 0 && !selectedSheet) {
        setSelectedSheet(remainingSheets[0]);
      }
    },
    onError: (error: Error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousSheets) {
        queryClient.setQueryData(getSheetsQueryKey(), context.previousSheets);
        
        // Restore selected sheet if it was deleted
        if (context.wasSelected && sheets.length > 0) {
          const restoredSheet = (context.previousSheets as any)?.find((sheet: any) => sheet.id === variables);
          if (restoredSheet) {
            setSelectedSheet(restoredSheet);
          }
        }
      }
      
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveMappingsMutation = useMutation({
    mutationFn: ({ sheetId, mappings }: { sheetId: string; mappings: Array<{ fieldName: string; columnLetter: string }> }) =>
      SheetsService.saveSheetMappings(sheetId, mappings),
    onMutate: async ({ sheetId, mappings }) => {
      if (!selectedSheet) return {};
      
      // Cancel any outgoing refetches
      const mappingsQueryKey = getSheetMappingsQueryKey(sheetId);
      await queryClient.cancelQueries({ queryKey: mappingsQueryKey });
      
      // Snapshot the previous value
      const previousMappings = queryClient.getQueryData(mappingsQueryKey);
      
      // Optimistically update the mappings cache
      queryClient.setQueryData(mappingsQueryKey, mappings);
      
      // Return rollback context
      return { previousMappings };
    },
    onSuccess: () => {
      toast({
        title: "Mappings saved",
        description: "Column mappings have been updated",
      });
      if (selectedSheet) {
        // Invalidate both sheet metadata and data since mappings affect display
        queryClient.invalidateQueries({ queryKey: getSheetQueryKey(selectedSheet.id) });
        queryClient.invalidateQueries({ queryKey: getSheetDataQueryKey(selectedSheet.id) });
      }
      setShowMapping(false);
    },
    onError: (error: Error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousMappings && selectedSheet) {
        queryClient.setQueryData(getSheetMappingsQueryKey(selectedSheet.id), context.previousMappings);
      }
      
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
        description: "Sheet data has been updated",
      });
      if (selectedSheet) {
        queryClient.invalidateQueries({ queryKey: getSheetDataQueryKey(selectedSheet.id) });
      }
      queryClient.invalidateQueries({ queryKey: getSheetsQueryKey() });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSheetAdded = () => {
    queryClient.invalidateQueries({ queryKey: getSheetsQueryKey() });
  };

  const handleDeleteSheet = (sheet: GoogleSheet) => {
    if (confirm(`Delete "${sheet.title}"? This action cannot be undone.`)) {
      deleteSheetMutation.mutate(sheet.id);
    }
  };

  const handleStartEdit = (sheet: GoogleSheet) => {
    setEditingSheetId(sheet.id);
    setEditingName(sheet.title);
  };

  const handleSaveEdit = () => {
    if (!editingSheetId || !editingName.trim()) return;
    updateSheetMutation.mutate({ id: editingSheetId, title: editingName.trim() });
  };

  const handleCancelEdit = () => {
    setEditingSheetId(null);
    setEditingName("");
  };

  const handleSaveMappings = (mappingData: Array<{ fieldName: string; columnLetter: string }>) => {
    if (!selectedSheet) return;
    saveMappingsMutation.mutate({ sheetId: selectedSheet.id, mappings: mappingData });
  };

  const handleSync = () => {
    if (!selectedSheet) return;
    syncDataMutation.mutate(selectedSheet.id);
  };

  if (sheetsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" data-testid="heading-sheets">Google Sheets Sync</h2>
        <Link href="/settings">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-configure-sheets">
            <Sparkles className="w-4 h-4 mr-2" />
            Configure Sheets
          </Button>
        </Link>
      </div>

      {sheets.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <div className="text-muted-foreground">
                No Google Sheets connected yet. Use Smart Field Selection to get started.
              </div>
              <Link href="/settings">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-configure-sheets">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Configure Sheets
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Your Sheets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sheets.map((sheet) => (
                  <div
                    key={sheet.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedSheet?.id === sheet.id ? "bg-primary/10 border-primary" : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedSheet(sheet)}
                    data-testid={`sheet-item-${sheet.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        {editingSheetId === sheet.id ? (
                          <div className="flex gap-2 items-center">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              className="text-sm h-8"
                              data-testid={`input-edit-name-${sheet.id}`}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleSaveEdit}
                              disabled={updateSheetMutation.isPending || !editingName.trim()}
                              data-testid={`button-save-edit-${sheet.id}`}
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              disabled={updateSheetMutation.isPending}
                              data-testid={`button-cancel-edit-${sheet.id}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="font-medium truncate" data-testid={`sheet-title-${sheet.id}`}>
                              {sheet.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Added {new Date(sheet.createdAt).toLocaleDateString()}
                            </div>
                          </>
                        )}
                      </div>
                      {editingSheetId !== sheet.id && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(sheet);
                            }}
                            disabled={updateSheetMutation.isPending}
                            data-testid={`button-edit-${sheet.id}`}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSheet(sheet);
                            }}
                            disabled={deleteSheetMutation.isPending}
                            data-testid={`button-delete-${sheet.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {selectedSheet ? (
              <div className="space-y-6">
                {showMapping ? (
                  <ColumnMapping
                    availableColumns={["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]}
                    initialMappings={mappings.map(m => ({ fieldName: m.fieldName, columnLetter: m.columnLetter }))}
                    onSave={handleSaveMappings}
                    onCancel={() => setShowMapping(false)}
                    isLoading={saveMappingsMutation.isPending}
                  />
                ) : (
                  <SimpleDataView
                    sheet={selectedSheet}
                    data={sheetData}
                    onSync={handleSync}
                    isLoading={syncDataMutation.isPending || dataLoading}
                  />
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    Select a sheet from the list to view and manage its data
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}