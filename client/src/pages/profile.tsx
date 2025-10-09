import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/auth";
import { ArrowLeftIcon } from "lucide-react";
import { Link } from "@/lib/router";
import { ProfileInfoCard } from "@/components/profile/profile-info-card";
import { DangerZoneCard } from "@/components/profile/danger-zone-card";

function ProfileContent() {
  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getCurrentUser,
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4" data-testid="link-back-dashboard">
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
          <p className="text-muted-foreground mt-2">Account Info</p>
        </div>

        <div className="space-y-6">
          <ProfileInfoCard user={user} />
          <DangerZoneCard />
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  return <ProfileContent />;
}