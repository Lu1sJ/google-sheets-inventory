import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/auth";
import { AppHeader } from "@/components/layout/app-header";
import { CleanInventory, type CleanInventoryRef } from "@/components/sheets/clean-inventory";
import type { GoogleSheet } from "@/services/sheets-service";

function DashboardContent() {
  const [currentSheet, setCurrentSheet] = useState<GoogleSheet | null>(null);
  const cleanInventoryRef = useRef<CleanInventoryRef>(null);
  
  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getCurrentUser,
  });

  if (!user) return null;

  return (
    <div className="h-screen bg-background flex flex-col">
      <AppHeader user={user} currentSheet={currentSheet} />
      <div className="flex-1 min-h-0">
        <CleanInventory ref={cleanInventoryRef} user={user} currentSheet={currentSheet} setCurrentSheet={setCurrentSheet} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  return <DashboardContent />;
}
