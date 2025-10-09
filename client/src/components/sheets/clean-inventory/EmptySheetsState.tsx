import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Sparkles } from "lucide-react";
import { Link } from "@/lib/router";

interface EmptySheetsStateProps {
  // Props simplified - no longer need dialog state since we redirect to /settings
}

export function EmptySheetsState({}: EmptySheetsStateProps) {
  return (
    <div className="h-[calc(100vh-80px)] bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-24 h-24 mx-auto bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
          <FileSpreadsheet className="w-12 h-12 text-blue-600" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-3" data-testid="text-empty-title">
          No Sheets Connected
        </h2>
        <p className="text-gray-600 mb-8" data-testid="text-empty-subtitle">
          Connect your first Google Sheet and configure it with Smart Field Selection or choose a Preset
        </p>
        <Link href="/settings">
          <Button 
            className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white" 
            data-testid="button-configure-sheets"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Configure Sheets
          </Button>
        </Link>
      </div>
    </div>
  );
}