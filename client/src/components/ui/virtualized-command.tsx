import { useState, useMemo, useCallback } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface VirtualizedOption {
  value: string;
  label: string;
  data?: any;
}

interface VirtualizedCommandProps {
  options: VirtualizedOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  onSelect?: (option: VirtualizedOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  itemHeight?: number;
  maxHeight?: number;
  displayValue?: (option: VirtualizedOption | undefined) => string;
  testId?: string;
}

// Optimized display: Only show first 50 items initially, more when searching
const MAX_INITIAL_ITEMS = 50;

export function VirtualizedCommand({
  options,
  value,
  onValueChange,
  onSelect,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  disabled = false,
  className,
  itemHeight = 40,
  maxHeight = 300,
  displayValue,
  testId = "virtualized-command"
}: VirtualizedCommandProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Memoized filtered options for performance
  const filteredOptions = useMemo(() => {
    if (!searchValue.trim()) {
      // When no search, only show first MAX_INITIAL_ITEMS for performance
      return options.slice(0, MAX_INITIAL_ITEMS);
    }
    
    const searchLower = searchValue.toLowerCase();
    return options.filter(option => 
      option.label.toLowerCase().includes(searchLower) ||
      option.value.toLowerCase().includes(searchLower)
    );
  }, [options, searchValue]);

  const selectedOption = useMemo(() => 
    options.find((option) => option.value === value),
    [options, value]
  );

  const handleSelect = useCallback((option: VirtualizedOption) => {
    onValueChange?.(option.value);
    onSelect?.(option);
    setOpen(false);
    setSearchValue(""); // Clear search when closing
  }, [onValueChange, onSelect]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearchValue(""); // Clear search when closing
    }
  }, []);

  const displayText = displayValue 
    ? displayValue(selectedOption) 
    : selectedOption?.label || placeholder;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          data-testid={`button-${testId}`}
        >
          <span className="truncate pr-2">{displayText}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList style={{ maxHeight: `${maxHeight}px` }}>
            <CommandEmpty>No options found.</CommandEmpty>
            {!searchValue.trim() && filteredOptions.length === MAX_INITIAL_ITEMS && (
              <div className="px-2 py-1 text-xs text-muted-foreground border-b">
                Showing first {MAX_INITIAL_ITEMS} items. Search to see all options.
              </div>
            )}
            {filteredOptions.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => handleSelect(option)}
                className="flex items-center justify-between py-2"
                data-testid={`option-${option.value.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <span className="font-medium truncate pr-2">{option.label}</span>
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    value === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}