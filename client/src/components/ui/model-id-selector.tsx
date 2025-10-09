import { useMemo } from "react";
import { VirtualizedCommand } from "@/components/ui/virtualized-command";
import { MODEL_OPTIONS, type ModelOption } from "@/data/model-options";

interface ModelIdSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  onModelSelect?: (model: ModelOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ModelIdSelector({
  value,
  onValueChange,
  onModelSelect,
  placeholder = "Model ID",
  disabled = false,
  className,
}: ModelIdSelectorProps) {
  // Memoized options for performance
  const virtualizedOptions = useMemo(() => 
    MODEL_OPTIONS.map((model) => ({
      value: model.modelId,
      label: model.modelId,
      data: model,
    })),
    []
  );

  const handleSelect = (option: any) => {
    onValueChange?.(option.value);
    onModelSelect?.(option.data);
  };

  const displayValue = (option: any) => {
    return option ? option.label : placeholder;
  };

  return (
    <VirtualizedCommand
      options={virtualizedOptions}
      value={value}
      onValueChange={onValueChange}
      onSelect={handleSelect}
      placeholder={placeholder}
      searchPlaceholder="Search model ID..."
      disabled={disabled}
      className={className}
      displayValue={displayValue}
      testId="model-id-selector"
      itemHeight={45}
      maxHeight={300}
    />
  );
}