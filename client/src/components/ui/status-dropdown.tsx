import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { STATUS_OPTIONS, getStatusOption, type StatusOption } from "@/data/status-options";

interface StatusDropdownProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

interface StatusDisplayProps {
  value: string;
  className?: string;
}

export function StatusDropdown({ value, onChange, disabled = false, placeholder = "Select status...", className }: StatusDropdownProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={`h-8 ${className}`}>
        <div className="truncate">
          {value ? <StatusDisplay value={value} /> : <span className="text-gray-500">{placeholder}</span>}
        </div>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StatusDisplay({ value, className }: StatusDisplayProps) {
  const statusOption = getStatusOption(value);
  
  if (!statusOption) {
    return <span className={`text-gray-800 ${className}`}>{value || '-'}</span>;
  }

  return (
    <span className={`text-gray-800 ${className}`}>
      {statusOption.label}
    </span>
  );
}

// Smart component that shows dropdown for editing or display for viewing
interface SmartStatusProps {
  value: string;
  onChange?: (value: string) => void;
  isEditable?: boolean;
  className?: string;
  placeholder?: string;
}

export function SmartStatus({ value, onChange, isEditable = false, className, placeholder }: SmartStatusProps) {
  if (isEditable && onChange) {
    return (
      <StatusDropdown 
        value={value} 
        onChange={onChange} 
        className={className}
        placeholder={placeholder}
      />
    );
  }
  
  return <StatusDisplay value={value} className={className} />;
}