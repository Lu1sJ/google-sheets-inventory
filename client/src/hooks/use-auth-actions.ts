import { useMutation } from "@tanstack/react-query";
import { logout } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useRouter } from "@/lib/router";
import { useToast } from "@/hooks/use-toast";

export function useLogout() {
  const { push } = useRouter();
  const { toast } = useToast();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      push("/");
      toast({
        title: "Signed out",
        description: "You have been successfully signed out",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteAccount() {
  const { push } = useRouter();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/profile");
    },
    onSuccess: () => {
      push("/");
      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    },
  });
}

export function useLogoutAllDevices() {
  const { push } = useRouter();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/logout-all");
    },
    onSuccess: () => {
      push("/");
      toast({
        title: "Signed out from all devices",
        description: "You have been signed out from all devices",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to sign out from all devices. Please try again.",
        variant: "destructive",
      });
    },
  });
}