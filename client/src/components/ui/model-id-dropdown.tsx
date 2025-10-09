import { ModelIdSelector } from "./model-id-selector";
import { MODEL_OPTIONS, type ModelOption } from "@/data/model-options";

interface ModelIdDropdownProps {
  value: string;
  onChange?: (value: string) => void;
  onModelSelect?: (model: ModelOption) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

interface ModelIdDisplayProps {
  value: string;
  className?: string;
}

export function ModelIdDropdown({ 
  value, 
  onChange, 
  onModelSelect,
  disabled = false, 
  placeholder = "Model ID", 
  className 
}: ModelIdDropdownProps) {
  return (
    <ModelIdSelector
      value={value}
      onValueChange={onChange}
      onModelSelect={onModelSelect}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
}

export function ModelIdDisplay({ value, className }: ModelIdDisplayProps) {
  const model = MODEL_OPTIONS.find(m => m.modelId === value);
  
  if (!model) {
    return <span className={`text-gray-800 ${className}`}>{value || '-'}</span>;
  }

  return (
    <div className={`text-gray-800 ${className}`}>
      <div className="font-medium text-sm">{model.modelId}</div>
      <div className="flex gap-2 text-xs text-muted-foreground">
        <span className="bg-secondary px-1 py-0.5 rounded text-xs">{model.type}</span>
        <span>{model.manufacturer}</span>
      </div>
    </div>
  );
}

// Smart component that shows dropdown for editing or display for viewing
interface SmartModelIdProps {
  value: string;
  onChange?: (value: string) => void;
  onModelSelect?: (model: ModelOption) => void;
  isEditable?: boolean;
  className?: string;
  placeholder?: string;
}

export function SmartModelId({ 
  value, 
  onChange, 
  onModelSelect,
  isEditable = false, 
  className, 
  placeholder 
}: SmartModelIdProps) {
  if (isEditable && onChange) {
    return (
      <ModelIdDropdown 
        value={value} 
        onChange={onChange} 
        onModelSelect={onModelSelect}
        className={className}
        placeholder={placeholder}
      />
    );
  }
  
  return <ModelIdDisplay value={value} className={className} />;
}