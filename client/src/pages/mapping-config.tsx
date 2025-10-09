import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { SheetsService } from "@/services/sheets-service";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { createHeaderConfig } from "@/utils/header-utils";
import { getSheetDataQueryKey, getSheetMappingsQueryKey } from "@/constants/sheets";

export function MappingConfigPage() {
  const { push } = useRouter();
  // For now, we'll get sheetId from query params or use a default
  const sheetId = new URLSearchParams(window.location.search).get('sheetId');
  const { toast } = useToast();
  
  const [mappingInputs, setMappingInputs] = useState<Record<string, string>>({});

  // Get sheet data to extract headers
  const { data: sheetData = [], error: sheetDataError } = useQuery({
    queryKey: sheetId ? getSheetDataQueryKey(sheetId) : ["sheets", "none", "data"],
    queryFn: () => sheetId ? SheetsService.getSheetData(sheetId) : Promise.resolve([]),
    enabled: !!sheetId,
    retry: false,
  });

  // Get existing mappings
  const { data: mappings = [], error: mappingsError } = useQuery({
    queryKey: sheetId ? getSheetMappingsQueryKey(sheetId) : ["sheets", "none", "mappings"],
    queryFn: () => sheetId ? SheetsService.getSheetMappings(sheetId) : Promise.resolve([]),
    enabled: !!sheetId,
    retry: false,
  });

  // Handle 404 errors for deleted sheets
  useEffect(() => {
    if (sheetDataError || mappingsError) {
      const error = sheetDataError || mappingsError;
      if (error && 'status' in error && (error as any).status === 404) {
        toast({
          title: "Sheet not found",
          description: "This sheet may have been deleted. Redirecting to settings...",
          variant: "destructive",
        });
        setTimeout(() => push('/settings'), 2000);
      }
    }
  }, [sheetDataError, mappingsError, toast, push]);

  // Create header configuration using centralized utility
  const headerConfig = createHeaderConfig(sheetData, mappings);
  const { tableHeaders, getColumnDisplayName } = headerConfig;

  // Initialize mapping inputs from existing mappings
  useEffect(() => {
    if (mappings.length > 0) {
      const inputs: Record<string, string> = {};
      mappings.forEach(mapping => {
        inputs[mapping.columnLetter] = mapping.fieldName;
      });
      setMappingInputs(inputs);
    }
  }, [mappings]);

  const saveMappingsMutation = useMutation({
    mutationFn: (mappings: Array<{ fieldName: string; columnLetter: string }>) => 
      sheetId ? SheetsService.saveSheetMappings(sheetId, mappings) : Promise.reject(new Error("No sheet selected")),
    onSuccess: () => {
      toast({
        title: "Mappings saved",
        description: "Column mappings updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: sheetId ? getSheetMappingsQueryKey(sheetId) : ["sheets", "none", "mappings"] });
      push('/settings');
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleMappingInputChange = (column: string, value: string) => {
    setMappingInputs(prev => ({
      ...prev,
      [column]: value
    }));
  };

  const handleSaveMappings = () => {
    if (!sheetId) return;

    const mappingsToSave = Object.entries(mappingInputs)
      .filter(([column, fieldName]) => fieldName && fieldName.trim())
      .map(([columnLetter, fieldName]) => ({
        fieldName: fieldName.trim(),
        columnLetter,
      }));

    saveMappingsMutation.mutate(mappingsToSave);
  };

  if (!sheetId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-500">
          <p>No sheet selected</p>
          <Button onClick={() => push('/settings')} className="mt-4">
            Go to Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => push('/settings')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Settings
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Map Columns</h1>
              <p className="text-sm text-gray-600">Configure how your Google Sheet columns are displayed</p>
            </div>
          </div>
          <Button 
            onClick={handleSaveMappings} 
            disabled={saveMappingsMutation.isPending}
            className="flex items-center gap-2"
            data-testid="save-mappings-button"
          >
            <Save className="w-4 h-4" />
            {saveMappingsMutation.isPending ? 'Saving...' : 'Save Mappings'}
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              Map your Google Sheet columns to field names. This helps organize and display your data more clearly.
            </p>
          </div>

          {tableHeaders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No columns found in the sheet data.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {tableHeaders.map((column, index) => (
                <div key={column} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                      {column}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      Column {column}
                    </div>
                    <div className="text-xs text-gray-500">
                      Current display: {getColumnDisplayName(column)}
                    </div>
                  </div>

                  <div className="flex-shrink-0 w-64">
                    <Select
                      value={mappingInputs[column] ?? (getColumnDisplayName(column) !== `Column ${index + 1}` ? getColumnDisplayName(column) : '')}
                      onValueChange={(value) => handleMappingInputChange(column, value)}
                    >
                      <SelectTrigger className="w-full" data-testid={`mapping-select-${column}`}>
                        <SelectValue placeholder="Select or type display name..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asset Tag">Asset Tag</SelectItem>
                        <SelectItem value="Serial Number">Serial Number</SelectItem>
                        <SelectItem value="Device Type">Device Type</SelectItem>
                        <SelectItem value="Brand">Brand</SelectItem>
                        <SelectItem value="Model">Model</SelectItem>
                        <SelectItem value="Location">Location</SelectItem>
                        <SelectItem value="Status">Status</SelectItem>
                        <SelectItem value="Assigned To">Assigned To</SelectItem>
                        <SelectItem value="Purchase Date">Purchase Date</SelectItem>
                        <SelectItem value="Warranty Expiry">Warranty Expiry</SelectItem>
                        <SelectItem value="Notes">Notes</SelectItem>
                        <SelectItem value="Manager Sign-off">Manager Sign-off</SelectItem>
                        <SelectItem value="Technician">Technician</SelectItem>
                        <SelectItem value="Equipment Move?">Equipment Move?</SelectItem>
                        <SelectItem value="Name">Name</SelectItem>
                        <SelectItem value="Type">Type</SelectItem>
                        <SelectItem value="Manufacturer">Manufacturer</SelectItem>
                        <SelectItem value="Model ID">Model ID</SelectItem>
                        <SelectItem value="Scanned Asset">Scanned Asset</SelectItem>
                        <SelectItem value="Scanned SN">Scanned SN</SelectItem>
                        <SelectItem value="Product Number">Product Number</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}