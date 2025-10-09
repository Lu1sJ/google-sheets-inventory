import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { IMAGE_OPTIONS, getImageOption, type ImageOption } from "@/data/image-options";

interface ImageDropdownProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

interface ImageDisplayProps {
  value: string;
  className?: string;
}

export function ImageDropdown({ value, onChange, disabled = false, placeholder = "Select image...", className }: ImageDropdownProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={`h-8 ${className}`}>
        <div className="truncate">
          {value ? <ImageDisplay value={value} /> : <span className="text-gray-500">{placeholder}</span>}
        </div>
      </SelectTrigger>
      <SelectContent>
        {IMAGE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ImageDisplay({ value, className }: ImageDisplayProps) {
  const imageOption = getImageOption(value);
  
  if (!imageOption) {
    return <span className={`text-gray-800 ${className}`}>{value || '-'}</span>;
  }

  return (
    <span className={`text-gray-800 ${className}`}>
      {imageOption.label}
    </span>
  );
}

// Smart component that shows dropdown for editing or display for viewing
interface SmartImageProps {
  value: string;
  onChange?: (value: string) => void;
  isEditable?: boolean;
  className?: string;
  placeholder?: string;
}

export function SmartImage({ value, onChange, isEditable = false, className, placeholder }: SmartImageProps) {
  if (isEditable && onChange) {
    return (
      <ImageDropdown 
        value={value} 
        onChange={onChange} 
        className={className}
        placeholder={placeholder}
      />
    );
  }
  
  return <ImageDisplay value={value} className={className} />;
}