import { useAuth } from "@/hooks/use-auth";
import { usePowerData } from "@/hooks/use-power-data";
import { Button } from "@/components/ui/button";
import { 
  Menu,
  Zap,
  ChevronDown,
  User,
  Bell,
  Settings
} from "lucide-react";
import { useState } from "react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

type HeaderProps = {
  onToggleSidebar: () => void;
};

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logoutMutation } = useAuth();
  const { dataStatus, lastUpdated } = usePowerData();
  
  return (
    <header className="border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 z-40 fixed top-0 left-0 right-0">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4 lg:gap-6">
          {/* Mobile menu toggle */}
          <Button 
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onToggleSidebar}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
          
          {/* App Logo */}
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg tracking-tight">Dalys Monitoring System</span>
          </div>
        </div>
        
        {/* Right side menu items */}
        <div className="flex items-center gap-4">
          {/* Data status indicator */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Data:</span>
            <Badge variant={dataStatus === 'live' ? "default" : dataStatus === 'synthetic' ? "secondary" : "outline"}>
              {dataStatus === 'live' ? 'Live' : dataStatus === 'synthetic' ? 'Synthetic' : 'Offline'}
            </Badge>
          </div>
          
          {/* Last update time */}
          {lastUpdated && (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Last Update:</span>
              <span className="text-sm font-medium">
                {formatDistanceToNow(lastUpdated, { addSuffix: true })}
              </span>
            </div>
          )}
          
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Notifications</span>
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary"></span>
          </Button>
          
          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2" size="sm">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium">{user?.username}</p>
                  <p className="text-xs text-muted-foreground">{user?.role}</p>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={() => logoutMutation.mutate()}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
