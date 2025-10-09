import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  CheckCircle, 
  UserIcon, 
  SettingsIcon, 
  LogOutIcon,
  BellIcon,
  ChevronDownIcon,
  CrownIcon
} from "lucide-react";
import { Link } from "@/lib/router";
import { UserAvatar } from "@/components/auth/user-avatar";
import { useLogout } from "@/hooks/use-auth-actions";
import type { User } from "@/lib/auth";

interface AppHeaderProps {
  user: User;
  currentSheet?: any;
}

export function AppHeader({ user, currentSheet }: AppHeaderProps) {
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="bg-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-white" />
              <span className="text-lg font-semibold">Sync 2 Inventory</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Connected to Google Sheets</span>
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-6">
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 p-2 text-white hover:bg-slate-600" data-testid="button-user-menu">
                  <UserAvatar name={user.name} picture={user.picture} size="sm" />
                  <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2 border-b border-border mb-2">
                  <div className="font-medium text-popover-foreground">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                  <div className="text-xs text-muted-foreground mt-1">Google Account</div>
                </div>
                
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center" data-testid="link-account-settings">
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Account Settings
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center" data-testid="link-settings">
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Configure Sheets
                  </Link>
                </DropdownMenuItem>
                
                {user.role === "admin" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center" data-testid="link-admin-panel">
                        <CrownIcon className="w-4 h-4 mr-2" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                  data-testid="button-logout"
                >
                  <LogOutIcon className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}