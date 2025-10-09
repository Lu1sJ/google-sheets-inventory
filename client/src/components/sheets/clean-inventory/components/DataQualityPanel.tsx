import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SheetRow = Record<string, string>;

interface DataQualityPanelProps {
  data: SheetRow[];
  tableHeaders: string[];
  getColumnDisplayName: (columnKey: string) => string;
}

interface QualityIssue {
  type: 'duplicate-serial' | 'duplicate-asset';
  count: number;
  items: Array<{ rowIndex: number; value: string }>;
}

export function DataQualityPanel({ data, tableHeaders, getColumnDisplayName }: DataQualityPanelProps) {
  const qualityMetrics = useMemo(() => {
    // Placeholder values that should not be counted as duplicates
    const placeholderValues = [
      'not on site',
      'n/a',
      'na',
      'none',
      'missing',
      'unknown',
      'tbd',
      'to be determined',
      'not available',
      'not assigned'
    ];
    
    const isPlaceholder = (value: string): boolean => {
      const normalized = value.toLowerCase().trim();
      return placeholderValues.includes(normalized);
    };
    
    // Find serial and asset tag columns (original data columns)
    const serialColumns = tableHeaders.filter(header => {
      const displayName = getColumnDisplayName(header).toLowerCase();
      return displayName.includes('serial') && !displayName.includes('scanned');
    });
    
    const assetTagColumns = tableHeaders.filter(header => {
      const displayName = getColumnDisplayName(header).toLowerCase();
      return (displayName.includes('asset') && displayName.includes('tag')) || 
             displayName.includes('asset tag');
    });

    const serialColumn = serialColumns[0];
    const assetColumn = assetTagColumns[0];

    // Track values and their occurrences (with original values preserved)
    const serialMap = new Map<string, { indices: number[], originalValue: string }>();
    const assetMap = new Map<string, { indices: number[], originalValue: string }>();

    data.forEach((row, index) => {
      const serial = serialColumn ? (row[serialColumn] || '').toString().trim() : '';
      const asset = assetColumn ? (row[assetColumn] || '').toString().trim() : '';

      // Track serial numbers (exclude placeholders from duplicate detection)
      if (serial && serialColumn && !isPlaceholder(serial)) {
        const normalizedSerial = serial.toUpperCase();
        const existing = serialMap.get(normalizedSerial);
        if (existing) {
          existing.indices.push(index);
        } else {
          serialMap.set(normalizedSerial, { indices: [index], originalValue: serial });
        }
      }

      // Track asset tags (exclude placeholders from duplicate detection)
      if (asset && assetColumn && !isPlaceholder(asset)) {
        const normalizedAsset = asset.toUpperCase();
        const existing = assetMap.get(normalizedAsset);
        if (existing) {
          existing.indices.push(index);
        } else {
          assetMap.set(normalizedAsset, { indices: [index], originalValue: asset });
        }
      }
    });

    // Find duplicates and get unique values (with original casing preserved)
    const duplicateSerialValues = Array.from(serialMap.entries())
      .filter(([_, data]) => data.indices.length > 1)
      .map(([_, data]) => data.originalValue);
    
    const duplicateSerials = Array.from(serialMap.entries())
      .filter(([_, data]) => data.indices.length > 1)
      .flatMap(([_, data]) => data.indices.map(idx => ({ rowIndex: idx, value: data.originalValue })));

    const duplicateAssetValues = Array.from(assetMap.entries())
      .filter(([_, data]) => data.indices.length > 1)
      .map(([_, data]) => data.originalValue);

    const duplicateAssets = Array.from(assetMap.entries())
      .filter(([_, data]) => data.indices.length > 1)
      .flatMap(([_, data]) => data.indices.map(idx => ({ rowIndex: idx, value: data.originalValue })));

    const issues: Array<QualityIssue & { duplicateValues?: string[] }> = [];

    // Only show duplicate metrics
    if (serialColumn) {
      issues.push({
        type: 'duplicate-serial',
        count: duplicateSerials.length - duplicateSerialValues.length,
        items: duplicateSerials,
        duplicateValues: duplicateSerialValues
      });
    }

    if (assetColumn) {
      issues.push({
        type: 'duplicate-asset',
        count: duplicateAssets.length - duplicateAssetValues.length,
        items: duplicateAssets,
        duplicateValues: duplicateAssetValues
      });
    }

    return issues;
  }, [data, tableHeaders, getColumnDisplayName]);

  const getIssueIcon = (type: QualityIssue['type']) => {
    return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  };

  const getIssueLabel = (type: QualityIssue['type']) => {
    switch (type) {
      case 'duplicate-serial':
        return 'Duplicate Serial Numbers';
      case 'duplicate-asset':
        return 'Duplicate Asset Tags';
      default:
        return '';
    }
  };

  const getIssueColor = (type: QualityIssue['type']) => {
    return 'bg-amber-50 border-amber-200';
  };

  const totalIssues = qualityMetrics.reduce((sum, issue) => sum + issue.count, 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Data Quality</h3>
        {totalIssues === 0 ? (
          <div className="flex items-center gap-1.5 text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-medium">All Clear</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-gray-600">
            <span className="text-xs font-medium">{totalIssues} {totalIssues === 1 ? 'Issue' : 'Issues'}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <TooltipProvider>
          {qualityMetrics.map((issue) => (
            <Tooltip key={issue.type}>
              <TooltipTrigger asChild>
                <div
                  className={`rounded-md border p-3 transition-all ${
                    issue.count > 0 ? getIssueColor(issue.type) : 'bg-gray-50 border-gray-200'
                  } ${issue.count > 0 ? 'cursor-help hover:shadow-sm' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {issue.count > 0 ? getIssueIcon(issue.type) : <CheckCircle2 className="w-4 h-4 text-gray-400" />}
                      <span className={`text-sm font-medium ${issue.count > 0 ? 'text-gray-900' : 'text-gray-500'}`}>
                        {getIssueLabel(issue.type)}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        issue.count > 0 ? 'text-amber-700' : 'text-gray-400'
                      }`}
                    >
                      {issue.count}
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              {issue.count > 0 && issue.duplicateValues && issue.duplicateValues.length > 0 && (
                <TooltipContent side="left" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-xs">Duplicate Values:</p>
                    <div className="max-h-32 overflow-y-auto space-y-0.5">
                      {issue.duplicateValues.map((value, idx) => (
                        <p key={idx} className="text-xs font-mono">{value}</p>
                      ))}
                    </div>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
    </div>
  );
}
