import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

// Infinite loading hook for large sheet data
export function useInfiniteSheetData(sheetId: string, enabled: boolean = true) {
  const PAGE_SIZE = 50; // Load 50 rows at a time

  return useInfiniteQuery({
    queryKey: [...queryKeys.sheets.data(sheetId), 'infinite'],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await fetch(
        `/api/sheets/${sheetId}/data?offset=${pageParam}&limit=${PAGE_SIZE}`,
        { credentials: 'include' }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sheet data: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        data: data.data || [],
        nextCursor: data.data && data.data.length === PAGE_SIZE 
          ? pageParam + PAGE_SIZE 
          : undefined,
        hasMore: data.data && data.data.length === PAGE_SIZE,
      };
    },
    enabled: !!sheetId && enabled,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook for virtualized data loading with search
export function useVirtualizedSheetData(sheetId: string, searchQuery?: string) {
  return useInfiniteQuery({
    queryKey: searchQuery 
      ? [...queryKeys.sheets.data(sheetId), 'virtualized', searchQuery]
      : [...queryKeys.sheets.data(sheetId), 'virtualized'],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        offset: pageParam.toString(),
        limit: '100', // Larger page size for virtualization
        ...(searchQuery && { search: searchQuery }),
      });

      const response = await fetch(
        `/api/sheets/${sheetId}/data?${params}`,
        { credentials: 'include' }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sheet data: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        data: data.data || [],
        nextCursor: data.data && data.data.length === 100 
          ? pageParam + 100 
          : undefined,
        total: data.total || 0,
      };
    },
    enabled: !!sheetId,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 1 * 60 * 1000, // 1 minute for search results
  });
}