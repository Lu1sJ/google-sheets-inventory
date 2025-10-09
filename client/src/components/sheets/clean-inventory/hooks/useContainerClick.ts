import { useCallback, type MouseEvent } from 'react';

interface UseContainerClickProps {
  selectedRows: Set<number>;
  clearSelection: () => void;
}

export function useContainerClick({ selectedRows, clearSelection }: UseContainerClickProps) {
  const handleContainerClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Don't deselect if clicking on interactive elements or dropdown content
    const interactiveSelectors = [
      'table', 'button', 'input', 'select',
      '[role="combobox"]', '[role="button"]', '[role="menu"]', 
      '[role="menuitem"]', '[data-radix-collection-item]', 
      '[data-radix-popper-content-wrapper]',
      '[data-radix-portal]', '.radix-dropdown-menu-content'
    ];
    
    const isInteractiveElement = interactiveSelectors.some(selector => 
      target.closest(selector)
    );
    
    if (isInteractiveElement) {
      return;
    }
    
    // Deselect all rows when clicking in empty space
    if (selectedRows.size > 0) {
      clearSelection();
    }
  }, [selectedRows, clearSelection]);

  return { handleContainerClick };
}