import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink } from "lucide-react";
import { GoogleSheet } from "../../services/sheets-service";

interface SimpleDataViewProps {
  sheet: GoogleSheet;
  data: any[];
  onSync: () => void;
  isLoading: boolean;
}

export function SimpleDataView({ sheet, data, onSync, isLoading }: SimpleDataViewProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span>{sheet.title}</span>
              <a 
                href={sheet.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </CardTitle>
            <Button 
              onClick={onSync} 
              disabled={isLoading}
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Sync
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No data in sheet. Click sync to fetch data or add sample rows below.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Extract all column keys from the data
  const allColumns = new Set<string>();
  data.forEach(row => {
    Object.keys(row).forEach(key => {
      if (key !== '_rowIndex') {
        allColumns.add(key);
      }
    });
  });
  
  const columns = Array.from(allColumns).sort();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>{sheet.title}</span>
            <a 
              href={sheet.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </CardTitle>
          <Button 
            onClick={onSync} 
            disabled={isLoading}
            size="sm"
            className="gap-2"
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
        <div className="text-sm text-muted-foreground">
          {data.length} row{data.length !== 1 ? 's' : ''} • {columns.length} column{columns.length !== 1 ? 's' : ''}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Row
                </th>
                {columns.map(col => (
                  <th key={col} className="border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Column {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {data.map((row, index) => (
                <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900">
                    {index + 1}
                  </td>
                  {columns.map(col => (
                    <td key={col} className="border border-gray-200 px-3 py-2 text-sm text-gray-900">
                      {row[col] || ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}