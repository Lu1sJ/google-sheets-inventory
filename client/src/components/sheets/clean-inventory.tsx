import { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import { GoogleSheet } from "../../services/sheets-service";
import { useInventorySheet } from "./clean-inventory/hooks/useInventorySheet";
import { EmptySheetsState } from "./clean-inventory/EmptySheetsState";
import { ScanTab } from "./clean-inventory/ScanTab";
import { AddSheetDialog } from "./clean-inventory/AddSheetDialog";
{/* FieldSelectionDialog moved to Settings page */}

import type { User } from '@/lib/auth';

interface CleanInventoryProps {
  user: User;
  currentSheet: GoogleSheet | null;
  setCurrentSheet: (sheet: GoogleSheet | null) => void;
}

export interface CleanInventoryRef {
  // Ref interface for future methods if needed
}

export const CleanInventory = forwardRef<CleanInventoryRef, CleanInventoryProps>(
  ({ user, currentSheet, setCurrentSheet }, ref) => {
    const [showDialog, setShowDialog] = useState(false);
    const [showMappingDialog, setShowMappingDialog] = useState(false);

    const hook = useInventorySheet({ user, currentSheet, setCurrentSheet });

    // Close mapping dialog when save is successful
    useEffect(() => {
      if (hook.saveMappingsMutation.isSuccess) {
        setShowMappingDialog(false);
      }
    }, [hook.saveMappingsMutation.isSuccess]);

    // Close add sheet dialog when sheet is successfully connected
    useEffect(() => {
      if (hook.addSheetMutation.isSuccess) {
        setShowDialog(false);
      }
    }, [hook.addSheetMutation.isSuccess]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      // Future methods can be added here
    }));

  // No sheets - show simple empty state that redirects to /settings
  if (hook.sheets.length === 0) {
    return <EmptySheetsState />;
  }

  // Show inventory data - only scanning view, no tabs
  return (
    <div className="bg-gray-50 h-full flex flex-col">
      {/* Main Content */}
      <div className="container mx-auto px-6 pt-6 pb-0 flex-1 flex flex-col min-h-0">
        <ScanTab
          user={user}
          localSheetData={hook.localSheetData}
          setLocalSheetData={hook.setLocalSheetData}
          originalSheetData={hook.sheetData || []} // Pass original data for change tracking
          selectedRows={hook.selectedRows}
          setSelectedRows={hook.setSelectedRows}
          selectAll={hook.selectAll}
          setSelectAll={hook.setSelectAll}
          tableHeaders={hook.tableHeaders}
          hasUnsyncedChanges={hook.hasUnsyncedChanges}
          setHasUnsyncedChanges={hook.setHasUnsyncedChanges}
          isLoading={hook.isLoading}
          handleRefresh={hook.handleRefresh}
          handlePushChanges={hook.handlePushChanges}
          getColumnDisplayName={hook.getColumnDisplayName}
          mappings={hook.mappings} // Pass mappings from hook
          refreshDataMutation={hook.refreshDataMutation}
          pushChangesMutation={hook.pushChangesMutation}
          currentSheet={currentSheet}
        />
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
      />

{/* Smart Field Selection moved to Settings page for better UX */}

      {/* Settings Dialog */}
      {/* Settings dialog removed - now handled in /settings page */}
    </div>
  );
});