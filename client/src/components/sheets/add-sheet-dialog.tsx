import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SheetsService } from "../../services/sheets-service";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSheetsQueryKey } from "../../constants/sheets";

interface AddSheetDialogProps {
  onSheetAdded?: () => void;
}

export function AddSheetDialog({ onSheetAdded }: AddSheetDialogProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [customName, setCustomName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addSheetMutation = useMutation({
    mutationFn: ({ input, customName }: { input: string; customName?: string }) => 
      SheetsService.addSheet(input).then(async (result) => {
        // If user provided a custom name, update the sheet with that name
        if (customName && customName.trim()) {
          const updatedSheet = await SheetsService.updateSheet(result.sheet.id, { 
            title: customName.trim() 
          });
          return { ...result, sheet: updatedSheet };
        }
        return result;
      }),
    onMutate: async ({ input, customName }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: getSheetsQueryKey() });
      
      // Snapshot the previous value
      const previousSheets = queryClient.getQueryData(getSheetsQueryKey()) || [];
      
      // Create optimistic sheet object with proper field names
      const optimisticSheet = {
        id: `temp-${Date.now()}`, // Temporary ID
        title: customName?.trim() || 'New Sheet',
        url: input,
        isFromGoogleSheets: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Optimistically update the cache
      queryClient.setQueryData(getSheetsQueryKey(), (old: any) => 
        old ? [...old, optimisticSheet] : [optimisticSheet]
      );
      
      // Return rollback context
      return { previousSheets };
    },
    onSuccess: (data) => {
      // Replace optimistic update with real data
      queryClient.setQueryData(getSheetsQueryKey(), (old: any) => {
        if (!old) return [data.sheet];
        return old.map((sheet: any) => 
          sheet.id.startsWith('temp-') ? data.sheet : sheet
        );
      });
      
      toast({
        title: "Sheet added",
        description: "Google Sheet has been successfully added",
      });
      setOpen(false);
      setInput("");
      setCustomName("");
      onSheetAdded?.();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    addSheetMutation.mutate({ input: input.trim(), customName });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-add-sheet">
          <Plus className="w-4 h-4" />
          Add New Sheet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Google Sheet</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="sheet-input">Google Sheets URL or ID</Label>
            <Input
              id="sheet-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/... or sheet ID"
              disabled={addSheetMutation.isPending}
              data-testid="input-sheet-url"
            />
          </div>
          <div>
            <Label htmlFor="custom-name">Custom Name (Optional)</Label>
            <Input
              id="custom-name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Enter a custom name for this sheet"
              disabled={addSheetMutation.isPending}
              data-testid="input-custom-name"
            />
            <p className="text-sm text-muted-foreground mt-1">
              If not provided, the name from Google Sheets will be used
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={addSheetMutation.isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!input.trim() || addSheetMutation.isPending}
              data-testid="button-submit"
            >
              {addSheetMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Sheet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}