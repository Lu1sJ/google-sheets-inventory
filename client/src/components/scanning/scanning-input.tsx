import { useState, forwardRef, useEffect, useRef, useImperativeHandle } from "react";
import { Input } from "@/components/ui/input";
import { ScanLine } from "lucide-react";

interface ScanningInputProps {
  onScan?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export interface ScanningInputRef {
  focus: () => void;
}

export const ScanningInput = forwardRef<ScanningInputRef, ScanningInputProps>(
  ({ onScan, placeholder = "Scan or type an Asset Tag/SN", autoFocus = true }, ref) => {
    const [scanValue, setScanValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Expose focus method via ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
    }));

    // Auto-focus on mount if enabled
    useEffect(() => {
      if (autoFocus && inputRef.current) {
        inputRef.current.focus();
      }
    }, [autoFocus]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && scanValue.trim()) {
        onScan?.(scanValue.trim());
        setScanValue("");
        // Auto-focus after scan for next input
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }
    };

  return (
    <div className="relative">
      <ScanLine className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
      <Input
        ref={inputRef}
        value={scanValue}
        onChange={(e) => setScanValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="pl-10 text-lg py-3"
        data-testid="scanning-input"
      />
    </div>
  );
});