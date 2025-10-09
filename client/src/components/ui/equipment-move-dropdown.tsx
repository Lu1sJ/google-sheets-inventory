import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { EQUIPMENT_MOVE_OPTIONS, getEquipmentMoveOption, type EquipmentMoveOption } from "@/data/equipment-move-options";

interface EquipmentMoveDropdownProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

interface EquipmentMoveDisplayProps {
  value: string;
  className?: string;
}

export function EquipmentMoveDropdown({ value, onChange, disabled = false, placeholder = "Select move...", className }: EquipmentMoveDropdownProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={`h-8 ${className}`}>
        <div className="truncate">
          {value ? <EquipmentMoveDisplay value={value} /> : <span className="text-gray-500">{placeholder}</span>}
        </div>
      </SelectTrigger>
      <SelectContent>
        {EQUIPMENT_MOVE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EquipmentMoveDisplay({ value, className }: EquipmentMoveDisplayProps) {
  const equipmentMoveOption = getEquipmentMoveOption(value);
  
  if (!equipmentMoveOption) {
    return <span className={`text-gray-800 text-center ${className}`}>{value || '-'}</span>;
  }

  return (
    <span className={`text-gray-800 text-center ${className}`}>
      {equipmentMoveOption.label}
    </span>
  );
}

// Smart component that shows dropdown for editing or display for viewing
interface SmartEquipmentMoveProps {
  value: string;
  onChange?: (value: string) => void;
  isEditable?: boolean;
  className?: string;
  placeholder?: string;
}

export function SmartEquipmentMove({ value, onChange, isEditable = false, className, placeholder }: SmartEquipmentMoveProps) {
  if (isEditable && onChange) {
    return (
      <EquipmentMoveDropdown 
        value={value} 
        onChange={onChange} 
        className={className}
        placeholder={placeholder}
      />
    );
  }
  
  return <EquipmentMoveDisplay value={value} className={className} />;
}