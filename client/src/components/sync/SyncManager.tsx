import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface SyncItem {
  id: string;
  sourceSheetId: string;
  sourceRowIndex: number;
  itemType: string;
  itemData: Record<string, any>;
  status: 'pending' | 'synced' | 'failed';
  createdAt: string;
}

interface SyncManagerProps {
  availableSheets: Array<{
    id: string;
    title: string;
    sheetName?: string;
  }>;
}

export function SyncManager({ availableSheets }: SyncManagerProps) {
  const [pendingItems, setPendingItems] = useState<SyncItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const { toast } = useToast();

  // Find disposal and absolute inventory sheets
  const disposalSheet = availableSheets.find(sheet => 
    sheet.title?.toLowerCase().includes('disposal') || 
    sheet.sheetName?.toLowerCase().includes('disposal')
  );
  
  const absoluteSheet = availableSheets.find(sheet => 
    sheet.title?.toLowerCase().includes('absolute') || 
    sheet.sheetName?.toLowerCase().includes('absolute')
  );

  useEffect(() => {
    loadPendingItems();
  }, []);

  const loadPendingItems = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sync/queue', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setPendingItems(data.items || []);
      } else {
        console.error('Failed to load sync queue');
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
      toast({
        title: "Error",
        description: "Failed to load pending sync items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const syncToDisposalInventory = async (queueId: string) => {
    if (!disposalSheet) {
      toast({
        title: "Error",
        description: "Disposal Inventory sheet not found",
        variant: "destructive"
      });
      return;
    }

    setSyncing(`${queueId}-disposal`);
    try {
      const response = await fetch('/api/sync/disposal-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          queueId,
          targetSheetId: disposalSheet.id
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Item synced to Disposal Inventory",
        });
        await loadPendingItems(); // Refresh the list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing to disposal inventory:', error);
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setSyncing(null);
    }
  };

  const syncToAbsoluteInventory = async (queueId: string) => {
    if (!absoluteSheet) {
      toast({
        title: "Error",
        description: "Absolute Inventory sheet not found",
        variant: "destructive"
      });
      return;
    }

    setSyncing(`${queueId}-absolute`);
    try {
      const response = await fetch('/api/sync/absolute-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          queueId,
          targetSheetId: absoluteSheet.id
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Item synced to Absolute Inventory",
        });
        await loadPendingItems(); // Refresh the list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing to absolute inventory:', error);
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setSyncing(null);
    }
  };

  const formatItemData = (itemData: Record<string, any>) => {
    const name = itemData.Name || itemData.name || 'Unknown Item';
    const status = itemData.Status || itemData.status || 'Unknown Status';
    const serialNumber = itemData['Serial Number'] || itemData.serialNumber || 'N/A';
    
    return { name, status, serialNumber };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'synced':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'synced':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cross-Tab Sync Manager</CardTitle>
          <CardDescription>Loading pending sync items...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cross-Tab Sync Manager</CardTitle>
        <CardDescription>
          Sync decommissioned items to Disposal Inventory and Absolute Inventory sheets
        </CardDescription>
        
        {/* Target sheets status */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span>Disposal Inventory:</span>
            {disposalSheet ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {disposalSheet.title}
              </Badge>
            ) : (
              <Badge variant="destructive">Not Found</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span>Absolute Inventory:</span>
            {absoluteSheet ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {absoluteSheet.title}
              </Badge>
            ) : (
              <Badge variant="destructive">Not Found</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {pendingItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No pending sync items</p>
            <p className="text-sm">Items marked as "Decommissioned" will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingItems.map((item) => {
              const { name, status, serialNumber } = formatItemData(item.itemData);
              
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    {getStatusIcon(item.status)}
                    <div>
                      <div className="font-medium">{name}</div>
                      <div className="text-sm text-gray-600">
                        Serial: {serialNumber} • Status: {status}
                      </div>
                      <div className="text-xs text-gray-500">
                        Added: {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge className={getStatusColor(item.status)}>
                      {item.status}
                    </Badge>
                  </div>
                  
                  {item.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncToDisposalInventory(item.id)}
                        disabled={!!syncing || !disposalSheet}
                        className="min-w-0"
                      >
                        {syncing === `${item.id}-disposal` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Disposal
                          </>
                        )}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncToAbsoluteInventory(item.id)}
                        disabled={!!syncing || !absoluteSheet}
                        className="min-w-0"
                      >
                        {syncing === `${item.id}-absolute` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Absolute
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        <div className="mt-4 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={loadPendingItems}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Refresh Sync Queue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}