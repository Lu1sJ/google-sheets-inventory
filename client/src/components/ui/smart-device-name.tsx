import { SmartInlineText } from "./inline-text-editor";

interface SmartDeviceNameProps {
  value: string;
  onChange?: (value: string) => void;
  isEditable?: boolean;
  className?: string;
}

export function SmartDeviceName({ 
  value, 
  onChange, 
  isEditable = false, 
  className
}: SmartDeviceNameProps) {
  return (
    <SmartInlineText
      value={value}
      onChange={onChange}
      isEditable={isEditable}
      className={className}
      placeholder="Device name..."
    />
  );
}