import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, AlertCircle, CheckCircle, Info } from "lucide-react";
import { useState, useMemo } from "react";
import { 
  CANONICAL_FIELDS, 
  getFieldsByCategory, 
  searchFields, 
  autoMapFieldsToColumns,
  detectHeaderRow,
  type CanonicalField 
} from "@/lib/smart-field-mapping";

interface FieldSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetData: string[][];
  onSave: (mappings: Array<{
    fieldKey: string;
    fieldName: string;
    columnLetter: string;
    order: number;
  }>) => void;
  isLoading?: boolean;
  existingMappings?: Array<{
    fieldName: string;
    columnLetter: string;
  }>;
}

export function FieldSelectionDialog({
  open,
  onOpenChange,
  sheetData,
  onSave,
  isLoading = false,
  existingMappings = []
}: FieldSelectionDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);

  // Detect header row and get headers
  const headerRowIndex = useMemo(() => {
    if (!sheetData || sheetData.length === 0) return 0;
    return detectHeaderRow(sheetData);
  }, [sheetData]);

  const headerRow = useMemo(() => {
    if (!sheetData || sheetData.length === 0) return [];
    return sheetData[headerRowIndex] || [];
  }, [sheetData, headerRowIndex]);

  // Search and filter fields
  const filteredFields = useMemo(() => {
    return searchFields(searchQuery);
  }, [searchQuery]);

  const fieldsByCategory = useMemo(() => {
    const categories = getFieldsByCategory();
    const filtered: Record<string, CanonicalField[]> = {};
    
    Object.entries(categories).forEach(([category, fields]) => {
      const categoryFields = fields.filter(field => 
        filteredFields.some(f => f.key === field.key)
      );
      if (categoryFields.length > 0) {
        filtered[category] = categoryFields;
      }
    });
    
    return filtered;
  }, [filteredFields]);

  // Track which fields are already mapped (when in merge mode)
  const existingFieldNames = useMemo(() => {
    if (!mergeMode || existingMappings.length === 0) return new Set<string>();
    
    // Create a set of existing field names (normalized for comparison)
    const existingNames = new Set<string>();
    existingMappings.forEach(m => {
      const normalized = m.fieldName.toLowerCase().trim();
      existingNames.add(normalized);
      
      // Also add simplified versions without special characters
      const simplified = normalized.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
      existingNames.add(simplified);
    });
    
    return existingNames;
  }, [mergeMode, existingMappings]);

  // Check if a field is already mapped
  const isFieldAlreadyMapped = (field: CanonicalField): boolean => {
    if (!mergeMode || existingMappings.length === 0) return false;
    
    const fieldNameLower = field.displayName.toLowerCase().trim();
    const fieldNameSimplified = fieldNameLower.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    
    // Build all possible variations of this field (displayName + all aliases)
    const allFieldVariations = new Set<string>();
    
    // Add display name variations
    allFieldVariations.add(fieldNameLower);
    allFieldVariations.add(fieldNameSimplified);
    
    // Add all alias variations
    for (const alias of field.aliases) {
      const aliasLower = alias.toLowerCase().trim();
      const aliasSimplified = aliasLower.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
      allFieldVariations.add(aliasLower);
      allFieldVariations.add(aliasSimplified);
    }
    
    // Check each existing mapping against all field variations
    for (const existingMapping of existingMappings) {
      const existingLower = existingMapping.fieldName.toLowerCase().trim();
      const existingSimplified = existingLower.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
      
      // Direct match check
      if (allFieldVariations.has(existingLower) || allFieldVariations.has(existingSimplified)) {
        return true;
      }
      
      // Check if any field variation matches the existing name
      for (const variation of Array.from(allFieldVariations)) {
        // Exact match
        if (variation === existingLower || variation === existingSimplified) {
          return true;
        }
        
        // Check if existing starts with this variation followed by special chars
        // (e.g., "name" matches "name (model id - serial number)")
        const pattern = new RegExp(`^${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^a-z0-9]`, 'i');
        if (pattern.test(existingLower)) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Auto-mapping preview
  const autoMappingResult = useMemo(() => {
    if (!showPreview || selectedFields.size === 0 || headerRow.length === 0) {
      return null;
    }
    
    return autoMapFieldsToColumns(Array.from(selectedFields), headerRow);
  }, [selectedFields, headerRow, showPreview]);

  const handleFieldToggle = (fieldKey: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldKey)) {
      newSelected.delete(fieldKey);
    } else {
      newSelected.add(fieldKey);
    }
    setSelectedFields(newSelected);
    setShowPreview(false); // Reset preview when selection changes
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  const handleSave = () => {
    if (!autoMappingResult) return;
    
    // Convert auto-mapping results to the format expected by the backend
    let mappings = autoMappingResult.mappings.map((mapping, index) => {
      const field = CANONICAL_FIELDS.find(f => f.key === mapping.fieldKey);
      return {
        fieldKey: mapping.fieldKey,
        fieldName: field?.displayName || mapping.fieldKey,
        columnLetter: mapping.columnLetter,
        order: mapping.columnIndex
      };
    });
    
    // If merge mode is enabled, combine with existing mappings
    if (mergeMode && existingMappings.length > 0) {
      const existingFormatted = existingMappings.map((m, index) => ({
        fieldKey: m.fieldName.toLowerCase().replace(/\s+/g, ''),
        fieldName: m.fieldName,
        columnLetter: m.columnLetter,
        order: index
      }));

      // Filter out duplicates (keep existing mappings if column is already mapped)
      const existingColumns = new Set(existingFormatted.map(m => m.columnLetter));
      const newMappingsToAdd = mappings.filter(m => !existingColumns.has(m.columnLetter));
      
      // Combine existing + new, re-order
      mappings = [...existingFormatted, ...newMappingsToAdd].map((m, idx) => ({
        ...m,
        order: idx
      }));
    }
    
    onSave(mappings);
  };

  const categoryLabels = {
    identification: "🏷️ Identification",
    tracking: "📋 Tracking & Verification", 
    location: "📍 Location",
    status: "📊 Status & Workflow",
    technical: "⚙️ Technical Specs",
    admin: "👥 Administration"
  };

  const selectedCount = selectedFields.size;
  const hasAutoMapping = autoMappingResult && autoMappingResult.mappings.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ✨ Smart Field Selection
            <Badge variant="outline" className="ml-2">
              Auto-Mapping
            </Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select the fields you want to include. The app will automatically detect and map them to your spreadsheet columns.
          </p>
        </DialogHeader>

        <div className="flex-1 flex gap-6 min-h-0">
          {/* Left Panel - Field Selection */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="space-y-4 mb-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search fields... (e.g., 'serial', 'location', 'tech')"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="field-search-input"
                />
              </div>

              {/* Selection Summary */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {selectedCount} field{selectedCount !== 1 ? 's' : ''} selected
                </div>
                {selectedCount > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handlePreview}
                    data-testid="button-preview-mapping"
                  >
                    <Info className="w-4 h-4 mr-2" />
                    Preview Mapping
                  </Button>
                )}
              </div>
            </div>

            {/* Field Categories */}
            <ScrollArea className="flex-1">
              <div className="space-y-6 pr-4">
                {Object.entries(fieldsByCategory).map(([category, fields]) => (
                  <div key={category} className="space-y-3">
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      {categoryLabels[category as keyof typeof categoryLabels] || category}
                    </h3>
                    <div className="grid gap-2">
                      {fields.map((field) => {
                        const alreadyMapped = isFieldAlreadyMapped(field);
                        return (
                          <div
                            key={field.key}
                            className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                              alreadyMapped 
                                ? 'opacity-50 bg-muted/30' 
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <Checkbox
                              id={field.key}
                              checked={selectedFields.has(field.key)}
                              onCheckedChange={() => handleFieldToggle(field.key)}
                              disabled={alreadyMapped}
                              data-testid={`checkbox-field-${field.key}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <label 
                                  htmlFor={field.key}
                                  className={`font-medium text-sm ${alreadyMapped ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  {field.displayName}
                                </label>
                                {alreadyMapped && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                    Already mapped
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {field.description}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {field.aliases.slice(0, 3).map((alias) => (
                                  <Badge key={alias} variant="secondary" className="text-xs">
                                    {alias}
                                  </Badge>
                                ))}
                                {field.aliases.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{field.aliases.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Mapping Preview */}
          {showPreview && (
            <div className="w-96 border-l pl-6 flex flex-col min-h-0">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                🎯 Auto-Mapping Preview
                {headerRowIndex > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Headers detected in row {headerRowIndex + 1}
                  </Badge>
                )}
              </h3>

              <ScrollArea className="flex-1">
                <div className="space-y-4">
                  {/* Successful Mappings */}
                  {autoMappingResult?.mappings && autoMappingResult.mappings.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-green-700 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Successfully Mapped ({autoMappingResult.mappings.length})
                      </h4>
                      {autoMappingResult.mappings.map((mapping) => {
                        const field = CANONICAL_FIELDS.find(f => f.key === mapping.fieldKey);
                        const headerText = headerRow[mapping.columnIndex] || '';
                        return (
                          <div key={mapping.fieldKey} className="p-3 bg-green-50 rounded border border-green-200">
                            <div className="font-medium text-sm">{field?.displayName}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              → Column {mapping.columnLetter}: "{headerText}"
                            </div>
                            <Badge 
                              variant={mapping.confidence > 0.9 ? "default" : "secondary"} 
                              className="text-xs mt-2"
                            >
                              {Math.round(mapping.confidence * 100)}% confidence
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Unmatched Fields */}
                  {autoMappingResult?.unmatchedFields && autoMappingResult.unmatchedFields.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-amber-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Needs Manual Setup ({autoMappingResult.unmatchedFields.length})
                      </h4>
                      {autoMappingResult.unmatchedFields.map((fieldKey) => {
                        const field = CANONICAL_FIELDS.find(f => f.key === fieldKey);
                        return (
                          <div key={fieldKey} className="p-3 bg-amber-50 rounded border border-amber-200">
                            <div className="font-medium text-sm">{field?.displayName}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              No matching column found. You can add this manually later.
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Ambiguous Matches */}
                  {autoMappingResult?.ambiguousMatches && autoMappingResult.ambiguousMatches.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-blue-700 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Multiple Matches ({autoMappingResult.ambiguousMatches.length})
                      </h4>
                      {autoMappingResult.ambiguousMatches.map((ambiguous) => {
                        const field = CANONICAL_FIELDS.find(f => f.key === ambiguous.fieldKey);
                        return (
                          <div key={ambiguous.fieldKey} className="p-3 bg-blue-50 rounded border border-blue-200">
                            <div className="font-medium text-sm">{field?.displayName}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Multiple possible columns found - will use best match
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t space-y-3">
          {/* Merge Mode Checkbox - only show when there are existing mappings */}
          {existingMappings.length > 0 && (
            <div className="flex items-center space-x-2 p-3 bg-secondary/30 rounded-lg border border-border">
              <Checkbox 
                id="merge-mode-field-selection" 
                checked={mergeMode}
                onCheckedChange={(checked) => setMergeMode(checked as boolean)}
              />
              <label
                htmlFor="merge-mode-field-selection"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Add to current sheet (keep existing {existingMappings.length} field{existingMappings.length !== 1 ? 's' : ''})
              </label>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {hasAutoMapping ? (
                <span className="text-green-600 font-medium">
                  ✅ Ready to create smart mappings!
                </span>
              ) : selectedCount > 0 ? (
                "Click 'Preview Mapping' to see how fields will be matched"
              ) : (
                "Select fields you want to include in your data table"
              )}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!hasAutoMapping || isLoading}
                data-testid="button-save-field-selection"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {mergeMode ? `Add Fields (${autoMappingResult?.mappings.length || 0})` : `Create Smart Mappings (${autoMappingResult?.mappings.length || 0})`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}