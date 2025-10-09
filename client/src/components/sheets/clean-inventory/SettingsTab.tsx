import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { GoogleSheet } from "../../../services/sheets-service";
import { useState } from "react";
import { FieldSelectionDialog } from "./FieldSelectionDialog";

interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
  role?: string;
}

interface SettingsTabProps {
  currentSheet: GoogleSheet | null;
  isLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  user: User;
  // Smart field selection props from parent hook
  sheetData?: string[][];
  onSmartFieldMapping?: (mappings: Array<{
    fieldKey: string;
    fieldName: string;
    columnLetter: string;
    order: number;
  }>) => void;
  isSavingMappings?: boolean;
  isDisconnecting?: boolean;
  existingMappings?: Array<{
    fieldName: string;
    columnLetter: string;
  }>;
}

export function SettingsTab({
  currentSheet,
  isLoading,
  onConnect,
  onDisconnect,
  user,
  sheetData = [],
  onSmartFieldMapping,
  isSavingMappings = false,
  isDisconnecting = false,
  existingMappings = [],
}: SettingsTabProps) {
  const [showSmartMapping, setShowSmartMapping] = useState(false);
  
  const handleOpenSmartMapping = () => {
    if (currentSheet && onSmartFieldMapping) {
      setShowSmartMapping(true);
    }
  };
  return (
    <div className="bg-white rounded-lg border p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Sheet Settings</h2>
      
      <div className="grid gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-800">New Sheet Connection</h3>
          <p className="text-sm text-gray-600">Shows all columns by default. Use Smart Field Selection to customize or you can always Apply a Preset by going into Predefined Sheets and hit "Apply to Current".</p>
          <div className="flex flex-col gap-3 items-start">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button 
                    onClick={onConnect}
                    disabled={!!currentSheet}
                    className="w-auto"
                    data-testid="button-connect-sheet"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Connect New Sheet
                  </Button>
                </span>
              </TooltipTrigger>
              {currentSheet && (
                <TooltipContent>
                  <p>You can only work on one sheet at a time. Please remove current sheet to add a new sheet.</p>
                </TooltipContent>
              )}
            </Tooltip>
            
            {currentSheet && (
              <Button 
                onClick={onDisconnect}
                variant="destructive"
                disabled={isDisconnecting}
                size="sm"
                className="w-auto"
                data-testid="button-disconnect-sheet"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Disconnect Sheet
              </Button>
            )}
          </div>
        </div>
        
        {currentSheet && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-800">Column Configuration</h3>
            <Button 
              onClick={handleOpenSmartMapping}
              variant="outline"
              disabled={isLoading}
              className="w-full sm:w-auto"
              data-testid="button-smart-field-selection"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              ✨ Smart Field Selection
            </Button>
          </div>
        )}
      </div>

      {/* Smart Field Selection Dialog */}
      {currentSheet && onSmartFieldMapping && (
        <FieldSelectionDialog
          open={showSmartMapping}
          onOpenChange={setShowSmartMapping}
          sheetData={sheetData}
          onSave={(mappings) => {
            onSmartFieldMapping(mappings);
            setShowSmartMapping(false);
          }}
          isLoading={isSavingMappings}
          existingMappings={existingMappings}
        />
      )}
    </div>
  );
}