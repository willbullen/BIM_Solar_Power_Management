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
import { useRefreshRate, REFRESH_RATES } from '@/hooks/use-refresh-rate';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { User } from '@shared/schema';
import logoImage from '@assets/icononly_transparent_nobuffer.png';
import { SideNavMetrics } from '@/components/side-nav-metrics';
import { ConnectionStatus } from '@/components/ui/connection-status';

type LayoutProps = {
  children: React.ReactNode;
  user?: User | null;
};

// Export the component as both default and named export for flexibility
export function SharedLayout({ children, user }: LayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { powerData, environmentalData, dataStatus } = usePowerData();
  const { refreshInterval, setRefreshInterval, refreshRateLabel } = useRefreshRate();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Reports', href: '/reports', icon: AreaChart },
    { name: 'Forecasting', href: '/forecasting', icon: BarChart },
    { name: 'Equipment', href: '/equipment', icon: Package2 },
    { name: 'Operational Planning', href: '/planning', icon: Calendar },
    { name: 'AI Agent', href: '/agent', icon: MessageSquare },
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
              <img src={logoImage} alt="BIM Logo" className="h-8 w-auto" />
              <div className="flex flex-col">
                <span className="text-lg font-bold ml-1 bg-gradient-to-r from-blue-500 to-blue-700 bg-clip-text text-transparent">BIM</span>
                <span className="text-xs ml-1 text-muted-foreground">Management</span>
              </div>
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
                        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors",
                        isActive 
                          ? "bg-accent text-accent-foreground" 
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-accent/50"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{item.name}</span>
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
              
              {/* Connection status indicator */}
              <ConnectionStatus />
              
              <Separator orientation="vertical" className="h-8" />
              
              {/* Refresh Rate Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center gap-2 h-8 px-2">
                    <span className="text-sm text-muted-foreground">
                      {dataStatus === 'live' ? 'Live Data' : dataStatus === 'synthetic' ? 'Synthetic Data' : 'Offline'}
                    </span>
                    <span className={`flex h-2 w-2 rounded-full ${
                      dataStatus === 'live' ? 'bg-green-500' : 
                      dataStatus === 'synthetic' ? 'bg-yellow-500' : 
                      'bg-red-500'
                    }`}></span>
                    <span className="text-xs text-muted-foreground font-mono">{refreshRateLabel}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                  <DropdownMenuLabel>Refresh Rate</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup 
                    value={String(refreshInterval)} 
                    onValueChange={(value) => {
                      console.log(`Dropdown selection: changing refresh rate to ${value}ms`);
                      const numValue = Number(value);
                      if (!isNaN(numValue)) {
                        // Clear existing intervals and set new one
                        setRefreshInterval(numValue);
                        
                        // Store in localStorage
                        try {
                          localStorage.setItem('refreshRate', value);
                        } catch (e) {
                          console.error('Failed to save refresh rate:', e);
                        }
                      }
                    }}
                  >
                    {/* Import available refresh rates from the hook */}
                    {REFRESH_RATES.map((rate: { label: string; value: number }) => (
                      <DropdownMenuRadioItem key={rate.value} value={String(rate.value)}>
                        {rate.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
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

// Also export as default for backward compatibility
export default SharedLayout;