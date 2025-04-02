import { useAuth } from "@/hooks/use-auth";
import { usePowerData } from "@/hooks/use-power-data";
import { Button } from "@/components/ui/button";
import { 
  Menu,
  LightningBolt,
  ChevronDown,
  User
} from "lucide-react";
import { useState } from "react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

type HeaderProps = {
  onToggleSidebar: () => void;
};

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logoutMutation } = useAuth();
  const { dataStatus, lastUpdated } = usePowerData();
  
  return (
    <header className="app-header">
      <div className="flex items-center">
        {/* Mobile menu toggle */}
        <Button 
          variant="ghost"
          size="icon"
          className="lg:hidden mr-2"
          onClick={onToggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        {/* App Logo */}
        <div className="flex items-center">
          <LightningBolt className="h-6 w-6 text-accent mr-2" />
          <span className="text-white font-semibold text-lg">Emporium Power Monitor</span>
        </div>
      </div>
      
      {/* User dropdown */}
      <div className="flex items-center space-x-4">
        {/* Data status indicator */}
        <div className="hidden sm:flex items-center">
          <span className="text-sm text-muted-foreground mr-2">Data:</span>
          <span className={`status-badge ${dataStatus}`}>
            {dataStatus === 'live' ? 'Live' : dataStatus === 'synthetic' ? 'Synthetic' : 'Offline'}
          </span>
        </div>
        
        {/* Last update time */}
        {lastUpdated && (
          <div className="hidden md:flex items-center">
            <span className="text-sm text-muted-foreground mr-2">Last Update:</span>
            <span className="text-sm text-white">
              {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </span>
          </div>
        )}
        
        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center">
              <span className="mr-2 text-sm">{user?.role}</span>
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white">
                <User className="h-4 w-4" />
              </div>
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <span className="font-medium">{user?.username}</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <span className="text-muted-foreground">Role: {user?.role}</span>
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
    </header>
  );
}
