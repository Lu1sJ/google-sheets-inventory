import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/auth";
import { ArrowLeftIcon } from "lucide-react";
import { Link } from "@/lib/router";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsTab } from "@/components/sheets/clean-inventory/SettingsTab";
import { useInventorySheet } from "@/components/sheets/clean-inventory/hooks/useInventorySheet";
import { AddSheetDialog } from "@/components/sheets/clean-inventory/AddSheetDialog";
import { PredefinedSheetsTab } from "@/components/sheets/clean-inventory/PredefinedSheetsTab";
import { useToast } from "@/hooks/use-toast";
import { autoMapFieldsToColumns, detectHeaderRow } from "@/lib/smart-field-mapping";

function SettingsContent() {
  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getCurrentUser,
  });

  const [showDialog, setShowDialog] = useState(false);
  const [currentSheet, setCurrentSheet] = useState<any>(null);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  
  const { toast } = useToast();
  const hook = useInventorySheet({ user: user!, currentSheet, setCurrentSheet });

  // Sync currentSheet with the hook's sheets data after deletion
  useEffect(() => {
    if (hook.sheets.length === 0 && currentSheet !== null) {
      setCurrentSheet(null);
    }
  }, [hook.sheets, currentSheet]);

  // Clear currentSheet immediately when disconnect mutation is successful
  useEffect(() => {
    if (hook.deleteSheetMutation.isSuccess) {
      setCurrentSheet(null);
    }
  }, [hook.deleteSheetMutation.isSuccess]);

  // Close add sheet dialog when sheet is successfully connected
  useEffect(() => {
    if (hook.addSheetMutation.isSuccess) {
      setShowDialog(false);
    }
  }, [hook.addSheetMutation.isSuccess]);

  // Auto-apply template after successful sheet connection
  useEffect(() => {
    if (hook.addSheetMutation.isSuccess && selectedTemplate && currentSheet) {
      const applyTemplateAfterConnection = async () => {
        try {
          // Wait a bit for the sheet data to be available
          setTimeout(async () => {
            await handleApplyTemplate(selectedTemplate);
            setSelectedTemplate(null); // Clear the selected template
          }, 1000);
        } catch (error) {
          console.error("Failed to auto-apply template:", error);
          setSelectedTemplate(null);
        }
      };
      applyTemplateAfterConnection();
    }
  }, [hook.addSheetMutation.isSuccess, selectedTemplate, currentSheet]);

  const handleApplyTemplate = async (template: any) => {
    setIsApplyingTemplate(true);
    try {
      // If there's no current sheet, this would be used when creating a new sheet
      // For now, show a message that they need to connect a sheet first
      if (!currentSheet) {
        toast({
          title: "No Sheet Connected",
          description: "Please connect a Google Sheet first, then apply the template to configure field mappings.",
          variant: "destructive"
        });
        return;
      }

      // Get the actual sheet data to analyze headers
      const sheetData = hook.convertToFullGridFormat();
      if (!sheetData || sheetData.length === 0) {
        toast({
          title: "No Sheet Data",
          description: "Cannot apply template - no data found in connected sheet. Please sync your sheet data first.",
          variant: "destructive"
        });
        return;
      }

      // Detect header row and get headers
      const headerRowIndex = detectHeaderRow(sheetData);
      const headerRow = sheetData[headerRowIndex] || [];

      if (headerRow.length === 0) {
        toast({
          title: "No Headers Found",
          description: "Cannot apply template - no column headers found in the sheet.",
          variant: "destructive"
        });
        return;
      }

      // Separate visible and background fields
      const visibleFields = template.fields.filter((field: any) => field.visible !== false);
      const backgroundFields = template.fields.filter((field: any) => field.visible === false);
      
      // Use smart field mapping to find the best column matches for VISIBLE template fields only
      const visibleFieldKeys = visibleFields.map((field: any) => field.key);
      const autoMappingResult = autoMapFieldsToColumns(visibleFieldKeys, headerRow);

      // Convert the auto-mapping result to the format expected by handleSmartFieldMapping
      // Only include visible field mappings for display
      const mappings = autoMappingResult.mappings.map((mapping, index) => ({
        fieldKey: mapping.fieldKey,
        fieldName: visibleFields.find((f: any) => f.key === mapping.fieldKey)?.displayName || mapping.fieldKey,
        columnLetter: mapping.columnLetter,
        order: index
      }));

      // Create mappings for background fields but don't include them in display order
      // These will be available for cross-tab functionality but hidden from UI
      const backgroundMappings = backgroundFields.map((field: any, index: number) => {
        // Try to find a matching column for background fields too
        const backgroundAutoMap = autoMapFieldsToColumns([field.key], headerRow);
        const mapping = backgroundAutoMap.mappings[0];
        
        return {
          fieldKey: field.key,
          fieldName: field.displayName,
          columnLetter: mapping?.columnLetter || '', // May be empty if no match found
          order: visibleFields.length + index, // Place after visible fields
        };
      });

      // Combine visible and background mappings
      const allMappings = [...mappings, ...backgroundMappings];

      if (mappings.length === 0) {
        toast({
          title: "No Matching Columns",
          description: `Could not find any columns that match the "${template.name}" template visible fields. Please make sure your sheet headers match the expected field names.`,
          variant: "destructive"
        });
        return;
      }

      await hook.handleSmartFieldMapping(allMappings);
      
      // Show detailed results
      const visibleMatchedCount = mappings.length;
      const visibleUnmatchedCount = autoMappingResult.unmatchedFields.length;
      const backgroundMatchedCount = backgroundMappings.filter((m: any) => m.columnLetter).length;
      const backgroundUnmatchedCount = backgroundMappings.filter((m: any) => !m.columnLetter).length;
      
      let message = `Successfully mapped ${visibleMatchedCount} visible fields`;
      if (backgroundMatchedCount > 0) {
        message += ` and ${backgroundMatchedCount} background fields`;
      }
      if (visibleUnmatchedCount > 0 || backgroundUnmatchedCount > 0) {
        const totalUnmatched = visibleUnmatchedCount + backgroundUnmatchedCount;
        message += `, ${totalUnmatched} fields could not be automatically matched`;
      }
      message += ".";

      toast({
        title: "Template Applied",
        description: message,
      });
    } catch (error) {
      toast({
        title: "Failed to Apply Template",
        description: error instanceof Error ? error.message : "An error occurred while applying the template",
        variant: "destructive"
      });
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const handleUseTemplate = (template: any) => {
    // Pre-fill the sheet name based on the template
    hook.setSheetName(template.name);
    setSelectedTemplate(template);
    setShowDialog(true);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4" data-testid="link-back-dashboard">
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Configure Sheets</h1>
          <p className="text-muted-foreground mt-2">Manage your Google Sheets connection and settings</p>
        </div>

        <Tabs defaultValue="sheets" className="space-y-6">
          <TabsList>
            <TabsTrigger value="sheets" data-testid="tab-sheet-settings">Sheet Settings</TabsTrigger>
            <TabsTrigger value="predefined" data-testid="tab-predefined-sheets">Predefined Sheets</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sheets" className="space-y-6">
            <SettingsTab
              currentSheet={currentSheet}
              isLoading={hook.isLoading}
              onConnect={() => setShowDialog(true)}
              onDisconnect={hook.handleDeleteSheet}
              user={user}
              sheetData={hook.convertToFullGridFormat()}
              onSmartFieldMapping={hook.handleSmartFieldMapping}
              isSavingMappings={hook.saveMappingsMutation.isPending}
              isDisconnecting={hook.deleteSheetMutation.isPending}
              existingMappings={hook.mappings || []}
            />
          </TabsContent>

          <TabsContent value="predefined" className="space-y-6">
            <PredefinedSheetsTab 
              onApplyTemplate={handleApplyTemplate}
              onUseTemplate={handleUseTemplate}
              isApplying={isApplyingTemplate}
            />
          </TabsContent>
        </Tabs>
      </div>

      <AddSheetDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        sheetUrl={hook.sheetUrl}
        setSheetUrl={hook.setSheetUrl}
        sheetName={hook.sheetName}
        setSheetName={hook.setSheetName}
        onConnect={hook.handleAddSheet}
        isLoading={hook.isLoading}
        selectedTemplate={selectedTemplate}
      />

    </div>
  );
}

export default function Settings() {
  return <SettingsContent />;
}