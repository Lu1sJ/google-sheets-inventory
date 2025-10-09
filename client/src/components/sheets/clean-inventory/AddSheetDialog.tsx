import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface AddSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetUrl: string;
  setSheetUrl: (url: string) => void;
  sheetName: string;
  setSheetName: (name: string) => void;
  onConnect: () => void;
  isLoading: boolean;
  selectedTemplate?: { name: string; description: string } | null;
}

export function AddSheetDialog({
  open,
  onOpenChange,
  sheetUrl,
  setSheetUrl,
  sheetName,
  setSheetName,
  onConnect,
  isLoading,
  selectedTemplate,
}: AddSheetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {selectedTemplate ? `Connect ${selectedTemplate.name}` : "Connect Google Sheet"}
          </DialogTitle>
          {selectedTemplate && (
            <p className="text-sm text-gray-600 mt-2">
              {selectedTemplate.description}
            </p>
          )}
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <Input
            placeholder="Paste Google Sheets URL or ID..."
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onConnect()}
            data-testid="input-sheet-url"
          />
          <Input
            placeholder="Sheet name (e.g., Sheet1, Data, Inventory...)"
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onConnect()}
            data-testid="input-sheet-name"
          />
          <div className="text-xs text-gray-500">
            Specify which tab/sheet within the spreadsheet to connect to. Defaults to "Sheet1" if left empty.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={onConnect} 
              disabled={!sheetUrl.trim() || isLoading}
              className="flex-1"
              data-testid="button-connect"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}