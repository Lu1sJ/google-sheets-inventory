import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ColumnMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableHeaders: string[];
  mappingInputs: Record<string, string>;
  onMappingInputChange: (column: string, value: string) => void;
  onSave: () => void;
  getColumnDisplayName: (columnKey: string) => string;
  saveMappingsMutation: any;
}

export function ColumnMappingDialog({
  open,
  onOpenChange,
  tableHeaders,
  mappingInputs,
  onMappingInputChange,
  onSave,
  getColumnDisplayName,
  saveMappingsMutation,
}: ColumnMappingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Map Columns</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <p className="text-sm text-gray-600 mb-4">
            Map your Google Sheet columns to field names:
          </p>
          {tableHeaders.map((column, index) => (
            <div key={column} className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Column {column} Display Name
              </label>
              <Select
                value={mappingInputs[column] ?? (getColumnDisplayName(column) !== column ? getColumnDisplayName(column) : '')}
                onValueChange={(value) => onMappingInputChange(column, value)}
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
                  <SelectItem value="Date Checked">Date Checked</SelectItem>
                  <SelectItem value="Condition">Condition</SelectItem>
                  <SelectItem value="Equipment Move?">Equipment Move?</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={onSave}
              disabled={saveMappingsMutation.isPending}
              className="flex-1" 
              data-testid="button-save-mappings"
            >
              {saveMappingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Mappings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}