import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ExternalLink } from "lucide-react";
import { GoogleSheet, SheetMapping, SheetRow } from "../../services/sheets-service";

interface DataGridProps {
  sheet: GoogleSheet;
  mappings: SheetMapping[];
  data: SheetRow[];
  onSync: () => void;
  isLoading?: boolean;
}

export function DataGrid({ sheet, mappings, data, onSync, isLoading }: DataGridProps) {
  const [editData, setEditData] = useState<SheetRow[]>([]);

  useEffect(() => {
    setEditData(data);
  }, [data]);

  const getMappedValue = (row: SheetRow, fieldName: string): string => {
    const mapping = mappings.find(m => m.fieldName === fieldName);
    if (!mapping) return "";
    return row[mapping.columnLetter] || "";
  };

  const updateCell = (rowIndex: number, fieldName: string, value: string) => {
    const mapping = mappings.find(m => m.fieldName === fieldName);
    if (!mapping) return;

    const updated = [...editData];
    if (!updated[rowIndex]) {
      updated[rowIndex] = {};
    }
    updated[rowIndex][mapping.columnLetter] = value;
    setEditData(updated);
  };

  const addEmptyRow = () => {
    const emptyRow: SheetRow = {};
    mappings.forEach(mapping => {
      emptyRow[mapping.columnLetter] = "";
    });
    setEditData([...editData, emptyRow]);
  };

  const hasData = data.length > 0;
  const sortedMappings = [...mappings].sort((a, b) => a.order - b.order);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span data-testid="text-sheet-title">{sheet.title}</span>
            <a 
              href={sheet.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              data-testid="link-sheet-url"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </CardTitle>
          <Button 
            onClick={onSync} 
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="gap-2"
            data-testid="button-sync"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Sync
          </Button>
        </div>
        {sheet.lastSyncAt && (
          <div className="text-xs text-muted-foreground">
            Last synced: {new Date(sheet.lastSyncAt).toLocaleString()}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {mappings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Configure column mappings first to view data
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <div className="min-w-full">
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${sortedMappings.length}, 1fr)` }}>
                  {sortedMappings.map((mapping) => (
                    <div key={mapping.id} className="p-2 bg-muted rounded text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs" data-testid={`badge-column-${mapping.columnLetter}`}>
                          {mapping.columnLetter}
                        </Badge>
                        <span data-testid={`text-field-${mapping.fieldName.replace(/\s+/g, '-').toLowerCase()}`}>
                          {mapping.fieldName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {hasData ? (
                  <div className="mt-2 space-y-2">
                    {editData.map((row, rowIndex) => (
                      <div key={rowIndex} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${sortedMappings.length}, 1fr)` }}>
                        {sortedMappings.map((mapping) => (
                          <Input
                            key={`${rowIndex}-${mapping.id}`}
                            value={getMappedValue(row, mapping.fieldName)}
                            onChange={(e) => updateCell(rowIndex, mapping.fieldName, e.target.value)}
                            className="h-9"
                            data-testid={`input-cell-${rowIndex}-${mapping.fieldName.replace(/\s+/g, '-').toLowerCase()}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No data in sheet. Click sync to fetch data or add sample rows below.
                    </div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${sortedMappings.length}, 1fr)` }}>
                      {sortedMappings.map((mapping) => (
                        <div 
                          key={mapping.id} 
                          className="h-9 border-2 border-dashed border-muted rounded bg-muted/30 flex items-center justify-center text-xs text-muted-foreground"
                          data-testid={`placeholder-${mapping.fieldName.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          {mapping.columnLetter}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button 
              onClick={addEmptyRow}
              variant="outline" 
              size="sm"
              data-testid="button-add-row"
            >
              Add Row
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}