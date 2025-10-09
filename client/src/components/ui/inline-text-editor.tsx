import { useState, useRef, useEffect } from "react";

interface InlineTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function InlineTextEditor({ 
  value, 
  onChange, 
  placeholder = "Click to edit...", 
  className = "", 
  disabled = false 
}: InlineTextEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row selection
    if (!disabled) {
      setIsEditing(true);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row selection on mouse down
    e.preventDefault(); // Prevent default mouse behavior
  };

  const handleSave = () => {
    const trimmedValue = editValue.trim();
    // Only call onChange if the value actually changed
    if (trimmedValue !== value) {
      onChange(trimmedValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={`px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${className}`}
        placeholder={placeholder}
        data-testid="inline-text-input"
      />
    );
  }

  return (
    <span
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`cursor-pointer text-sm px-2 py-1 rounded transition-colors duration-200 ${
        isHovered && !disabled 
          ? 'bg-blue-50 text-blue-800 border border-blue-200' 
          : 'text-gray-800 hover:bg-gray-50'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${className}`}
      title={disabled ? '' : 'Click to edit'}
      data-testid="inline-text-display"
    >
      {value || placeholder}
    </span>
  );
}

interface InlineTextDisplayProps {
  value: string;
  className?: string;
}

export function InlineTextDisplay({ value, className }: InlineTextDisplayProps) {
  return (
    <span className={`text-gray-800 text-sm ${className}`}>
      {value || '-'}
    </span>
  );
}

interface SmartInlineTextProps {
  value: string;
  onChange?: (value: string) => void;
  isEditable?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function SmartInlineText({ 
  value, 
  onChange, 
  isEditable = false, 
  className, 
  placeholder,
  disabled = false
}: SmartInlineTextProps) {
  if (isEditable && onChange) {
    return (
      <InlineTextEditor 
        value={value} 
        onChange={onChange} 
        className={className}
        placeholder={placeholder}
        disabled={disabled}
      />
    );
  }
  
  return <InlineTextDisplay value={value} className={className} />;
}