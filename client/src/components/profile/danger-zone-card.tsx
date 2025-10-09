import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrashIcon, AlertTriangleIcon } from "lucide-react";
import { useDeleteAccount, useLogoutAllDevices } from "@/hooks/use-auth-actions";

export function DangerZoneCard() {
  const deleteAccountMutation = useDeleteAccount();
  const logoutAllDevicesMutation = useLogoutAllDevices();

  const handleDeleteAccount = () => {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      deleteAccountMutation.mutate();
    }
  };

  const handleLogoutAllDevices = () => {
    if (confirm("Sign out from all devices? You'll need to sign in again.")) {
      logoutAllDevicesMutation.mutate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangleIcon className="w-5 h-5" />
          Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
            <h4 className="font-medium text-foreground mb-2">Sign out from all devices</h4>
            <p className="text-sm text-muted-foreground mb-3">
              This will sign you out from all devices and invalidate all active sessions.
            </p>
            <Button 
              variant="outline" 
              onClick={handleLogoutAllDevices}
              disabled={logoutAllDevicesMutation.isPending}
              data-testid="button-logout-all-devices"
            >
              {logoutAllDevicesMutation.isPending ? "Signing out..." : "Sign Out All Devices"}
            </Button>
          </div>

          <div className="p-4 border border-destructive rounded-lg bg-destructive/5">
            <h4 className="font-medium text-destructive mb-2">Delete Account</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <Button 
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending}
              data-testid="button-delete-account"
            >
              <TrashIcon className="w-4 h-4 mr-2" />
              {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}