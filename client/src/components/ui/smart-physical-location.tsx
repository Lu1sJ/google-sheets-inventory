import { SmartInlineText } from "./inline-text-editor";

interface SmartPhysicalLocationProps {
  value: string;
  onChange?: (value: string) => void;
  isEditable?: boolean;
  className?: string;
}

export function SmartPhysicalLocation({ 
  value, 
  onChange, 
  isEditable = false, 
  className 
}: SmartPhysicalLocationProps) {
  return (
    <SmartInlineText
      value={value}
      onChange={onChange}
      isEditable={isEditable}
      className={className}
      placeholder="Physical location..."
    />
  );
}