import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, FileSpreadsheet, Plus } from "lucide-react";

interface PredefinedSheet {
  id: string;
  name: string;
  description: string;
  keyFeatures: string[];
  fields: {
    key: string;
    displayName: string;
    required?: boolean;
    visible?: boolean; // New property to control UI visibility
  }[];
}

interface PredefinedSheetsTabProps {
  onApplyTemplate: (template: PredefinedSheet) => void;
  onUseTemplate: (template: PredefinedSheet) => void;
  isApplying?: boolean;
}

const PREDEFINED_SHEETS: PredefinedSheet[] = [
  {
    id: 'branch-verified-inventory',
    name: 'Branch Verified Inventory',
    description: 'Complete inventory management with scanning, auto-fill, and cross-tab sync for decommissioned devices',
    keyFeatures: [
      'Scan Asset Tag and Serial Number to verify equipment',
      'Status and Image dropdowns with Scan Mode presets for bulk updates',
      'Auto-syncs decommissioned items to 4 tabs: Disposal Inventory, Absolute, Crowdstrike, and BookOps Laptops',
      'Auto-fills Technician email, Last Verified Date, and Description based on Status',
      'Data Quality panel tracks duplicates and missing data in real-time'
    ],
    fields: [
      // Visible columns
      { key: 'name', displayName: 'Name (Model ID - Serial Number)', required: true, visible: true },
      { key: 'serialNumber', displayName: 'Scan Serial Number', required: true, visible: true },
      { key: 'scannedSn', displayName: 'Scanned Sn', required: false, visible: true },
      { key: 'assetTag', displayName: 'Scan Asset Tag', required: true, visible: true },
      { key: 'scannedAsset', displayName: 'Scanned Asset', required: false, visible: true },
      { key: 'physicalLocation', displayName: 'Physical Location', required: true, visible: true },
      { key: 'image', displayName: 'Image', required: false, visible: true },
      { key: 'status', displayName: 'Status', required: false, visible: true },
      { key: 'equipmentMove', displayName: 'Equipment Move?', required: false, visible: true },
      // Background fields (CSS-hidden via [HIDDEN] prefix, but available for auto-fill and scan mode functionality)
      { key: 'technician', displayName: '[HIDDEN] Technician', required: false, visible: true },
      { key: 'lastVerifiedDate', displayName: '[HIDDEN] Last Verified Inventory date', required: false, visible: true },
      { key: 'description', displayName: '[HIDDEN] Description', required: false, visible: true }
    ]
  }
  // DECOMMISSION SYNC TEMPLATE - Hidden from UI but logic preserved for Branch Verified Inventory
  // {
  //   id: 'decommission-sync',
  //   name: 'Decommission Sync',
  //   description: 'Mark devices as decommissioned and sync it across all sheets',
  //   fields: [
  //     // Visible columns
  //     { key: 'name', displayName: 'Name (Model ID - Serial Number)', required: true, visible: true },
  //     { key: 'status', displayName: 'Mark as Decommissioned', required: true, visible: true },
  //     { key: 'equipmentMove', displayName: 'Update Equipment Move', required: true, visible: true },
  //     { key: 'deviceName', displayName: 'Device Name', required: false, visible: true },
  //     // Background fields (CSS-hidden via [HIDDEN] prefix, but available for cross-tab functionality)
  //     { key: 'type', displayName: '[HIDDEN] Type', required: false, visible: true },
  //     { key: 'serialNumber', displayName: '[HIDDEN] Serial Number', required: false, visible: true },
  //     { key: 'assetTag', displayName: '[HIDDEN] Asset Tag', required: false, visible: true },
  //     { key: 'description', displayName: '[HIDDEN] Description', required: false, visible: true }
  //   ]
  // }
];

export function PredefinedSheetsTab({ onApplyTemplate, onUseTemplate, isApplying = false }: PredefinedSheetsTabProps) {
  return (
    <div className="container-padding-lg space-section flex flex-col">
      {/* Header Section with improved typography */}
      <div className="mb-4">
        <h2 className="text-heading-2 text-gray-900 mb-2">Predefined Sheets</h2>
        <p className="text-body text-muted-foreground max-w-3xl">
          Choose from ready-made sheet templates with predefined field mappings optimized for NYPL workflows.
        </p>
      </div>

      {/* Templates Grid with better spacing */}
      <div className="grid gap-4">
        {PREDEFINED_SHEETS.map((sheet) => (
          <Card key={sheet.id} className="border-border shadow-card hover:shadow-card-hover transition-shadow duration-200">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                {/* Template Info with icon */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-3 bg-primary/10 rounded-xl flex-shrink-0">
                    <FileSpreadsheet className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-heading-3 mb-2">{sheet.name}</CardTitle>
                    <CardDescription className="text-body-sm text-muted-foreground">
                      {sheet.description}
                    </CardDescription>
                  </div>
                </div>
                {/* Action Buttons */}
                <div className="flex gap-3 flex-shrink-0">
                  <Button 
                    onClick={() => onUseTemplate(sheet)}
                    disabled={isApplying}
                    size="default"
                    className="shadow-sm"
                    data-testid={`button-use-${sheet.id}`}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Use Template
                  </Button>
                  <Button 
                    onClick={() => onApplyTemplate(sheet)}
                    disabled={isApplying}
                    variant="outline"
                    size="default"
                    data-testid={`button-apply-${sheet.id}`}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Apply to Current
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Key Features Section */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">
                  Key Features
                </h4>
                <ul className="space-y-2">
                  {sheet.keyFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Section with improved styling */}
      <div className="mt-4 bg-primary/5 rounded-xl p-4 border border-primary/20">
        <h3 className="text-sm font-semibold text-primary mb-2">How it works</h3>
        <div className="text-sm text-foreground space-y-2">
          <p className="flex items-start gap-3">
            <span className="text-primary mt-0.5">•</span>
            <span><strong className="font-semibold">Use Template:</strong> Pre-fills sheet name, then paste your Sheet ID to connect</span>
          </p>
          <p className="flex items-start gap-3">
            <span className="text-primary mt-0.5">•</span>
            <span><strong className="font-semibold">Apply to Current:</strong> Apply template mappings to an already connected sheet</span>
          </p>
          <p className="flex items-start gap-3">
            <span className="text-primary mt-0.5">•</span>
            <span>Templates automatically configure field mappings for optimal workflows</span>
          </p>
          <p className="flex items-start gap-3">
            <span className="text-primary mt-0.5">•</span>
            <span>You can still customize field selections after applying the template</span>
          </p>
        </div>
      </div>
    </div>
  );
}