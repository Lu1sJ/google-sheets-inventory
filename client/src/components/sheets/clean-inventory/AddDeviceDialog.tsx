import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { StatusDropdown } from "@/components/ui/status-dropdown";
import { EquipmentMoveDropdown } from "@/components/ui/equipment-move-dropdown";
import { LocationDropdown } from "@/components/ui/location-dropdown";
import { ModelIdDropdown } from "@/components/ui/model-id-dropdown";
import { ImageDropdown } from "@/components/ui/image-dropdown";
import { SmartAssignedTo } from "@/components/ui/smart-assigned-to";
import { SmartDeviceName } from "@/components/ui/smart-device-name";
import { SmartPhysicalLocation } from "@/components/ui/smart-physical-location";
import { type LocationOption } from "@/data/location-options";
import { type ModelOption } from "@/data/model-options";

const deviceFormSchema = z.object({
  status: z.string().min(1, "Status is required"),
  equipmentMove: z.string().optional(),
  serialNumber: z.string().min(1, "Serial Number is required"),
  productNumber: z.string().optional(),
  assetTag: z.string().min(1, "Asset Tag is required"),
  modelId: z.string().optional(),
  type: z.string().optional(),
  manufacturer: z.string().optional(),
  name: z.string().optional(), // Auto-generated from Model ID + Serial
  location: z.string().optional(),
  assignedTo: z.string().optional(),
  physicalLocation: z.string().optional(),
  deviceName: z.string().optional(), // User input
  image: z.string().optional(),
});

type DeviceFormData = z.infer<typeof deviceFormSchema>;

interface AddDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scannedValue: string;
  scannedType: 'serial' | 'asset';
  onAddDevice: (deviceData: DeviceFormData) => Promise<boolean>;
  isLoading?: boolean;
}


export function AddDeviceDialog({
  open,
  onOpenChange,
  scannedValue,
  scannedType,
  onAddDevice,
  isLoading = false
}: AddDeviceDialogProps) {
  const { toast } = useToast();
  const [showImageField, setShowImageField] = useState(false);

  const form = useForm<DeviceFormData>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues: {
      status: "",
      equipmentMove: "",
      serialNumber: "",
      productNumber: "",
      assetTag: "",
      modelId: "",
      type: "",
      manufacturer: "",
      name: "",
      location: "",
      assignedTo: "",
      physicalLocation: "",
      deviceName: "",
      image: "",
    },
  });
  
  // Handle model selection to update related fields
  const handleModelSelect = (model: ModelOption) => {
    // Update the form with model data
    form.setValue('modelId', model.modelId);
    form.setValue('type', model.type);
    form.setValue('manufacturer', model.manufacturer);
    
    // Generate Name (not Device Name) from model ID and serial number
    const currentSerial = form.getValues('serialNumber') || '';
    const name = [model.modelId, currentSerial].filter(Boolean).join(' - ');
    form.setValue('name', name);
  };
  
  // Update Name field when serial number changes
  const handleSerialChange = (value: string) => {
    form.setValue('serialNumber', value);
    const currentModelId = form.getValues('modelId') || '';
    if (currentModelId) {
      const name = [currentModelId, value].filter(Boolean).join(' - ');
      form.setValue('name', name);
    }
  };

  // Reset form with scanned values when dialog opens or scanned values change
  useEffect(() => {
    if (open && scannedValue) {
      form.reset({
        status: "",
        equipmentMove: "",
        serialNumber: scannedType === 'serial' ? scannedValue : "",
        productNumber: "",
        assetTag: scannedType === 'asset' ? scannedValue : "",
        modelId: "",
        type: "",
        manufacturer: "",
        name: "",
        location: "",
        assignedTo: "",
        physicalLocation: "",
        deviceName: "",
        image: "",
      });
    }
  }, [open, scannedValue, scannedType, form]);

  const handleSubmit = async (data: DeviceFormData) => {
    try {
      const result = await onAddDevice(data);
      
      // Only close dialog and show success if operation was successful
      if (result !== false) {
        form.reset();
        onOpenChange(false);
        toast({
          title: "Device Added",
          description: `Successfully added device with ${scannedType === 'asset' ? 'Asset Tag' : 'Serial Number'}: ${scannedValue}`,
          variant: "success"
        });
      }
      // If result is false, error handling is done by onAddDevice
    } catch (error) {
      // Handle unexpected errors
      toast({
        title: "Error",
        description: "Failed to add device. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle data-testid="dialog-title-add-device">
            Add New Device
          </DialogTitle>
          <DialogDescription>
            Scanned {scannedType === 'asset' ? 'Asset Tag' : 'Serial Number'} "{scannedValue}" was not found. 
            Add this device to your inventory sheet?
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <FormControl>
                      <StatusDropdown
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Select status"
                        className="h-8"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Equipment Move */}
              <FormField
                control={form.control}
                name="equipmentMove"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment Move?</FormLabel>
                    <FormControl>
                      <EquipmentMoveDropdown
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Select option"
                        className="h-8"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Serial Number */}
              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial Number *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        onChange={(e) => {
                          handleSerialChange(e.target.value);
                        }}
                        data-testid="input-serial-number" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Product Number */}
              <FormField
                control={form.control}
                name="productNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Number</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-product-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Asset Tag */}
              <FormField
                control={form.control}
                name="assetTag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Tag *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-asset-tag" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Model ID */}
              <FormField
                control={form.control}
                name="modelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model ID</FormLabel>
                    <FormControl>
                      <ModelIdDropdown
                        value={field.value || ""}
                        onChange={field.onChange}
                        onModelSelect={handleModelSelect}
                        placeholder="Select or type Model ID"
                        className="h-8"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Location */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <LocationDropdown
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Select location"
                        className="h-8"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assigned To */}
              <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned To</FormLabel>
                    <FormControl>
                      <SmartAssignedTo
                        value={field.value || ""}
                        onChange={field.onChange}
                        isEditable={true}
                        className="h-8"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Physical Location */}
              <FormField
                control={form.control}
                name="physicalLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Physical Location</FormLabel>
                    <FormControl>
                      <SmartPhysicalLocation
                        value={field.value || ""}
                        onChange={field.onChange}
                        isEditable={true}
                        className="h-8"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Device Name */}
              <FormField
                control={form.control}
                name="deviceName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device Name</FormLabel>
                    <FormControl>
                      <SmartDeviceName
                        value={field.value || ""}
                        onChange={field.onChange}
                        isEditable={true}
                        className="h-8"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Show "Type" field to determine if Image field should be shown */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Show Image Field?</label>
                <div className="flex items-center space-x-4 mt-2">
                  <Button
                    type="button"
                    variant={showImageField ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowImageField(true)}
                    data-testid="button-show-image-field"
                  >
                    Desktop/Laptop
                  </Button>
                  <Button
                    type="button"
                    variant={!showImageField ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowImageField(false)}
                    data-testid="button-hide-image-field"
                  >
                    Other Type
                  </Button>
                </div>
              </div>

              {/* Image Field - Conditional */}
              {showImageField && (
                <FormField
                  control={form.control}
                  name="image"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Image</FormLabel>
                      <FormControl>
                        <ImageDropdown
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder="Select image type"
                          className="h-8"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-add-device"
              >
                {isLoading ? "Adding..." : "Add Device"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}