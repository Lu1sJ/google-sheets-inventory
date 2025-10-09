import { SmartInlineText } from "./inline-text-editor";

interface SmartAssignedToProps {
  value: string;
  onChange?: (value: string) => void;
  isEditable?: boolean;
  className?: string;
}

export function SmartAssignedTo({ 
  value, 
  onChange, 
  isEditable = false, 
  className 
}: SmartAssignedToProps) {
  return (
    <SmartInlineText
      value={value}
      onChange={onChange}
      isEditable={isEditable}
      className={className}
      placeholder="Assigned to..."
    />
  );
}