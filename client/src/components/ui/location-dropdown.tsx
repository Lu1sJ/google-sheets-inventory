import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { VirtualizedCommand } from "@/components/ui/virtualized-command";
import { LOCATION_OPTIONS, getLocationOption, type LocationOption } from "@/data/location-options";

interface LocationDropdownProps {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect?: (location: LocationOption) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

interface LocationDisplayProps {
  value: string;
  className?: string;
}

export function LocationDropdown({ 
  value, 
  onChange, 
  onLocationSelect,
  disabled = false, 
  placeholder = "Select location...", 
  className 
}: LocationDropdownProps) {
  // Memoized options for performance
  const virtualizedOptions = useMemo(() => 
    LOCATION_OPTIONS.map((location) => ({
      value: location.location,
      label: location.location,
      data: location,
    })),
    []
  );

  const handleSelect = (option: any) => {
    onChange(option.value);
    onLocationSelect?.(option.data);
  };

  const displayValue = (option: any) => {
    return option ? option.label : placeholder;
  };

  return (
    <VirtualizedCommand
      options={virtualizedOptions}
      value={value}
      onValueChange={onChange}
      onSelect={handleSelect}
      placeholder={placeholder}
      searchPlaceholder="Search location..."
      disabled={disabled}
      className={`h-8 ${className}`}
      displayValue={displayValue}
      testId="location-dropdown"
      itemHeight={40}
      maxHeight={280}
    />
  );
}

export function LocationDisplay({ value, className }: LocationDisplayProps) {
  const locationOption = getLocationOption(value);
  
  if (!locationOption) {
    return <span className={`text-gray-800 ${className}`}>{value || '-'}</span>;
  }

  return (
    <span className={`text-gray-800 ${className}`}>
      {locationOption.location}
    </span>
  );
}

interface SmartLocationProps {
  value: string;
  onChange?: (value: string) => void;
  onLocationSelect?: (location: LocationOption) => void;
  isEditable?: boolean;
  className?: string;
  placeholder?: string;
}

export function SmartLocation({ 
  value, 
  onChange, 
  onLocationSelect,
  isEditable = false, 
  className, 
  placeholder 
}: SmartLocationProps) {
  if (isEditable && onChange) {
    return (
      <LocationDropdown 
        value={value} 
        onChange={onChange} 
        onLocationSelect={onLocationSelect}
        className={className}
        placeholder={placeholder}
      />
    );
  }
  
  return <LocationDisplay value={value} className={className} />;
}