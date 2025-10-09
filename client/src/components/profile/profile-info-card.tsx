import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserIcon, Pencil, Check, X } from "lucide-react";
import { UserAvatar } from "@/components/auth/user-avatar";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/lib/auth";

interface ProfileInfoCardProps {
  user: User;
}

export function ProfileInfoCard({ user }: ProfileInfoCardProps) {
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [email, setEmail] = useState(user.email);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateEmailMutation = useMutation({
    mutationFn: async (newEmail: string) => {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });
      if (!response.ok) throw new Error("Failed to update email");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setIsEditingEmail(false);
      toast({
        title: "Success",
        description: "Email updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update email",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateEmailMutation.mutate(email);
  };

  const handleCancel = () => {
    setEmail(user.email);
    setIsEditingEmail(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="w-5 h-5" />
          Profile Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-6">
          <UserAvatar name={user.name} picture={user.picture} size="lg" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground" data-testid="text-profile-name">{user.name}</h3>
            
            {isEditingEmail ? (
              <div className="mt-2 space-y-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@nypl.org"
                  className="max-w-md"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    size="sm"
                    disabled={updateEmailMutation.isPending}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    size="sm"
                    disabled={updateEmailMutation.isPending}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1 mt-1">
                <div className="flex items-center gap-2">
                  <p className="text-muted-foreground" data-testid="text-profile-email">{user.email}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingEmail(true)}
                    className="h-6 w-6 p-0"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  ↑ This will prefill your Technician fields. Change to NYPL during Demo Access.
                </p>
              </div>
            )}
            
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                Google Login
              </Badge>
              {user.isVerified && (
                <Badge variant="outline" className="text-xs">
                  Verified
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}