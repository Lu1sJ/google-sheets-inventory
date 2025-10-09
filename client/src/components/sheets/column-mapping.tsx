import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Save, ArrowUp, ArrowDown } from "lucide-react";
import { DEFAULT_FIELDS, COLUMN_LETTERS } from "../../constants/sheets";

interface ColumnMapping {
  fieldName: string;
  columnLetter: string;
}

interface ColumnMappingProps {
  availableColumns: string[];
  initialMappings?: ColumnMapping[];
  onSave: (mappings: ColumnMapping[]) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function ColumnMapping({ availableColumns, initialMappings = [], onSave, onCancel, isLoading }: ColumnMappingProps) {
  const [mappings, setMappings] = useState<ColumnMapping[]>(() => {
    if (initialMappings.length > 0) {
      return initialMappings;
    }
    return DEFAULT_FIELDS.map(field => ({ fieldName: field, columnLetter: "" }));
  });

  const [customField, setCustomField] = useState("");

  useEffect(() => {
    if (initialMappings.length > 0) {
      setMappings(initialMappings);
    }
  }, [initialMappings]);

  const addCustomField = () => {
    if (!customField.trim()) return;
    setMappings([...mappings, { fieldName: customField.trim(), columnLetter: "" }]);
    setCustomField("");
  };

  const updateMapping = (index: number, columnLetter: string) => {
    const updated = [...mappings];
    updated[index].columnLetter = columnLetter === "none" ? "" : columnLetter;
    setMappings(updated);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const moveMapping = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= mappings.length) return;
    
    const updated = [...mappings];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setMappings(updated);
  };

  const handleSave = () => {
    const validMappings = mappings.filter(m => m.fieldName && m.columnLetter);
    onSave(validMappings);
  };

  const isValidToSave = mappings.some(m => m.fieldName && m.columnLetter);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Column Mapping</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Map your data fields to Google Sheets columns. Available columns:
        </div>
        
        <div className="flex flex-wrap gap-2">
          {availableColumns.map((col) => (
            <Badge key={col} variant="outline" className="text-xs" data-testid={`badge-column-${col}`}>
              {col}
            </Badge>
          ))}
        </div>

        <div className="space-y-3">
          {mappings.map((mapping, index) => (
            <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-sm" data-testid={`text-field-${index}`}>
                  {mapping.fieldName}
                </div>
              </div>
              
              <Select 
                value={mapping.columnLetter || "none"} 
                onValueChange={(value) => updateMapping(index, value)}
                data-testid={`select-column-${index}`}
              >
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="Col" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableColumns.map((col) => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => moveMapping(index, "up")}
                  disabled={index === 0}
                  data-testid={`button-move-up-${index}`}
                >
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => moveMapping(index, "down")}
                  disabled={index === mappings.length - 1}
                  data-testid={`button-move-down-${index}`}
                >
                  <ArrowDown className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeMapping(index)}
                  disabled={mappings.length <= 1}
                  data-testid={`button-remove-${index}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={customField}
            onChange={(e) => setCustomField(e.target.value)}
            placeholder="Add custom field..."
            className="flex-1 px-3 py-2 border rounded text-sm"
            onKeyDown={(e) => e.key === "Enter" && addCustomField()}
            data-testid="input-custom-field"
          />
          <Button size="sm" onClick={addCustomField} disabled={!customField.trim()} data-testid="button-add-field">
            Add Field
          </Button>
        </div>

        <div className="flex gap-2 pt-4">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isLoading} data-testid="button-cancel-mapping">
              Cancel
            </Button>
          )}
          <Button 
            onClick={handleSave} 
            disabled={!isValidToSave || isLoading}
            data-testid="button-save-mapping"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Mappings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}