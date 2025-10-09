// Centralized query key factory for better cache management and type safety
export const queryKeys = {
  // User queries
  user: {
    all: ['users'] as const,
    current: () => [...queryKeys.user.all, 'current'] as const,
    profile: (userId: string) => [...queryKeys.user.all, 'profile', userId] as const,
    list: () => [...queryKeys.user.all, 'list'] as const,
  },

  // Sheet queries  
  sheets: {
    all: ['sheets'] as const,
    list: () => [...queryKeys.sheets.all, 'list'] as const,
    detail: (sheetId: string) => [...queryKeys.sheets.all, 'detail', sheetId] as const,
    data: (sheetId: string) => [...queryKeys.sheets.all, 'data', sheetId] as const,
    mappings: (sheetId: string) => [...queryKeys.sheets.all, 'mappings', sheetId] as const,
  },

  // Model and location queries (for dropdowns)
  models: {
    all: ['models'] as const,
    list: () => [...queryKeys.models.all, 'list'] as const,
    search: (query: string) => [...queryKeys.models.all, 'search', query] as const,
  },

  locations: {
    all: ['locations'] as const,
    list: () => [...queryKeys.locations.all, 'list'] as const,
    search: (query: string) => [...queryKeys.locations.all, 'search', query] as const,
  },
} as const;

// Helper functions for query invalidation
export const invalidateUserQueries = (queryClient: any) => {
  return queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
};

export const invalidateSheetQueries = (queryClient: any, sheetId?: string) => {
  if (sheetId) {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.sheets.detail(sheetId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sheets.data(sheetId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sheets.mappings(sheetId) }),
    ]);
  }
  return queryClient.invalidateQueries({ queryKey: queryKeys.sheets.all });
};

export const prefetchSheetData = async (queryClient: any, sheetId: string) => {
  // Prefetch related data when a sheet is selected
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: queryKeys.sheets.data(sheetId),
      staleTime: 2 * 60 * 1000, // 2 minutes
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.sheets.mappings(sheetId),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
  ]);
};