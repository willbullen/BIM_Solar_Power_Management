import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  BarChart,
  Bell,
  Calendar,
  Cog,
  Home,
  LayoutDashboard,
  MenuIcon,
  MessageSquare,
  Package2,
  PanelLeft,
  Settings,
  SunMedium,
  X,
  Zap,
  Sun,
  CloudSun
} from 'lucide-react';
import { usePowerData } from '@/hooks/use-power-data';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { User } from '@shared/schema';
import logoImage from '@assets/icononly_transparent_nobuffer.png';
import { SideNavMetrics } from '@/components/side-nav-metrics';

type LayoutProps = {
  children: React.ReactNode;
  user?: User | null;
};

export default function SharedLayout({ children, user }: LayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { powerData, environmentalData } = usePowerData();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Reports', href: '/reports', icon: AreaChart },
    { name: 'Forecasting', href: '/forecasting', icon: BarChart },
    { name: 'Equipment', href: '/equipment', icon: Package2 },
    { name: 'Operational Planning', href: '/planning', icon: Calendar },
    { name: 'Feedback & Issues', href: '/feedback', icon: MessageSquare },
    { name: 'Settings', href: '/settings', icon: Settings }
  ];

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
      {/* Mobile menu button */}
      <button
        className="fixed top-4 left-4 z-50 rounded-md p-2 text-primary lg:hidden"
        onClick={toggleMobileMenu}
      >
        {mobileMenuOpen ? <X size={20} /> : <MenuIcon size={20} />}
      </button>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[280px] transform bg-sidebar border-r border-sidebar-border transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex h-14 items-center border-b px-6 border-sidebar-border">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <img src={logoImage} alt="Emporium Logo" className="h-8 w-auto" />
              <span className="text-lg font-bold ml-1 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">Emporium</span>
            </Link>
          </div>
          <ScrollArea className="flex-1 py-4">
            <nav className="grid gap-1 px-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <Link 
                    key={item.name} 
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                        isActive 
                          ? "bg-accent text-accent-foreground" 
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-accent/50"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
            
            {/* Added metrics */}
            <div className="mt-6 px-2">
              <SideNavMetrics />
            </div>
          </ScrollArea>
          <div className="mt-auto border-t border-sidebar-border p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-9 w-9">
                <AvatarImage src="" alt="User Avatar" />
                <AvatarFallback className="bg-accent/10 text-accent">
                  {user?.username?.substring(0, 2)?.toUpperCase() || 'US'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-sidebar-foreground">
                  {user?.username || 'Guest User'}
                </span>
                <span className="text-xs text-sidebar-foreground/70">
                  {/* We don't have email in the user model, so we'll use a placeholder or role */}
                  {user?.role ? `Role: ${user.role}` : 'guest@example.com'}
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-auto text-sidebar-foreground/70">
                    <Cog className="h-4 w-4" />
                    <span className="sr-only">Toggle user menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col h-screen overflow-hidden">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6">
          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold">Power Monitoring System</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:flex items-center gap-4">
              {/* Power Widget */}
              <div className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">
                  {powerData ? `${powerData.totalLoad.toFixed(1)} kW` : '-- kW'}
                </span>
              </div>
              
              {/* Environmental Widget */}
              <div className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1">
                <CloudSun className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium">
                  {environmentalData ? `${environmentalData.air_temp.toFixed(1)}°C` : '--°C'}
                </span>
                <Sun className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-medium">
                  {environmentalData ? `${environmentalData.ghi.toFixed(0)} W/m²` : '-- W/m²'}
                </span>
              </div>
              
              <Button variant="outline" size="icon" className="rounded-full">
                <Bell className="h-4 w-4" />
                <span className="sr-only">Notifications</span>
              </Button>
              <Separator orientation="vertical" className="h-8" />
              <span className="text-sm text-muted-foreground">Live Data</span>
              <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}