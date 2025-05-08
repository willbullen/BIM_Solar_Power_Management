import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  BarChart,
  Bell,
  Calendar,
  Cog,
  LayoutDashboard,
  MenuIcon,
  MessageSquare,
  Package2,
  Settings,
  SunMedium,
  X,
  Zap,
  Sun,
  CloudSun,
  Thermometer
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
import { Progress } from '@/components/ui/progress';
import { User } from '@shared/schema';
import logoImage from '@assets/icononly_transparent_nobuffer.png';

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
          "fixed inset-y-0 left-0 z-40 w-[280px] transform bg-[#0F1425] text-white transition-transform duration-200 lg:static lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <ScrollArea className="flex-1 py-4">
            <nav className="grid gap-1 px-6">
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
                        "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                        isActive 
                          ? "bg-[#1E2A45] text-white" 
                          : "text-white/80 hover:text-white hover:bg-[#1E2A45]/50"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
            
            {/* Current Metrics Section */}
            <div className="mt-8 px-6">
              <h3 className="text-xs uppercase tracking-wider text-white/50 mb-3">CURRENT METRICS</h3>
              
              {/* Grid Power */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-white" />
                    <span className="text-sm">Grid Power</span>
                  </div>
                  <span className="text-sm font-medium">
                    {powerData && powerData.mainGridPower ? `${powerData.mainGridPower.toFixed(1)} kW` : '0.0 kW'}
                  </span>
                </div>
                <Progress 
                  value={powerData && powerData.mainGridPower ? Math.min(100, (powerData.mainGridPower / 10) * 100) : 0} 
                  className="h-1 bg-white/10" 
                />
              </div>
              
              {/* Solar Output */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm">Solar Output</span>
                  </div>
                  <span className="text-sm font-medium">
                    {powerData && powerData.solarOutput ? `${powerData.solarOutput.toFixed(1)} kW` : '0.0 kW'}
                  </span>
                </div>
                <Progress 
                  value={powerData && powerData.solarOutput ? Math.min(100, (powerData.solarOutput / 10) * 100) : 0} 
                  className="h-1 bg-white/10" 
                />
              </div>
              
              {/* Total Load */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">Total Load</span>
                  </div>
                  <span className="text-sm font-medium">
                    {powerData && powerData.totalLoad ? `${powerData.totalLoad.toFixed(1)} kW` : '0.0 kW'}
                  </span>
                </div>
                <Progress 
                  value={powerData && powerData.totalLoad ? Math.min(100, (powerData.totalLoad / 15) * 100) : 0} 
                  className="h-1 bg-white/10" 
                />
              </div>
              
              {/* Environmental Data Section */}
              <h3 className="text-xs uppercase tracking-wider text-white/50 mb-3">ENVIRONMENTAL DATA</h3>
              
              {/* Weather */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CloudSun className="h-4 w-4 text-blue-400" />
                  <span className="text-sm">Weather</span>
                </div>
                <span className="text-sm font-medium">
                  {environmentalData ? environmentalData.weather : 'Unknown'}
                </span>
              </div>
              
              {/* Temperature */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-red-400" />
                  <span className="text-sm">Temperature</span>
                </div>
                <span className="text-sm font-medium">
                  {environmentalData ? `${environmentalData.air_temp.toFixed(1)}°C` : '0.0°C'}
                </span>
              </div>
              
              {/* Solar Radiation */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm">Solar Radiation</span>
                </div>
                <span className="text-sm font-medium">
                  {environmentalData ? `${environmentalData.ghi.toFixed(0)} W/m²` : '0 W/m²'}
                </span>
              </div>
            </div>
          </ScrollArea>
          
          {/* Collapse Button */}
          <div className="p-4">
            <Button 
              variant="outline" 
              className="w-full bg-[#1E2A45] hover:bg-[#2A3A5A] text-white border-none"
              onClick={toggleMobileMenu}
            >
              Collapse
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col">
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