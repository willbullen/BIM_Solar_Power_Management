import { cn } from "@/lib/utils";
import { useState, ReactNode } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePowerData } from "@/hooks/use-power-data";
import { 
  Zap, 
  BarChart3, 
  Settings, 
  FileDown,
  TrendingUp,
  Wrench,
  CalendarClock,
  MessageCircle,
  Cloud,
  BatteryCharging,
  Activity
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { 
    powerData, 
    environmentalData 
  } = usePowerData();

  return (
    <>
      {/* Mobile sidebar backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 z-20 lg:hidden transition-opacity", 
          collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        onClick={onToggle}
      />
      
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r bg-sidebar transition-transform duration-300",
        "max-h-screen overflow-hidden pt-16 lg:translate-x-0",
        collapsed ? "-translate-x-full" : "translate-x-0"
      )}>
        <div className="flex flex-col h-full overflow-auto scrollbar-thin scrollbar-thumb-muted">
          {/* Sidebar Menu */}
          <div className="flex-1 p-4">
            <nav className="grid gap-1">
              <Link
                href="/dashboard"
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                  "hover:bg-accent/50 hover:text-accent-foreground",
                  (location === "/" || location === "/dashboard") 
                    ? "bg-accent/70 text-accent-foreground" 
                    : "transparent"
                )}
              >
                <BarChart3 className="mr-3 h-4 w-4" />
                Dashboard
              </Link>
              
              <Link
                href="/reports"
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                  "hover:bg-accent/50 hover:text-accent-foreground",
                  location === "/reports" 
                    ? "bg-accent/70 text-accent-foreground" 
                    : "transparent"
                )}
              >
                <FileDown className="mr-3 h-4 w-4" />
                Reports
              </Link>
              
              <Link
                href="/forecasting"
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                  "hover:bg-accent/50 hover:text-accent-foreground",
                  location === "/forecasting" 
                    ? "bg-accent/70 text-accent-foreground" 
                    : "transparent"
                )}
              >
                <TrendingUp className="mr-3 h-4 w-4" />
                Forecasting
              </Link>
              
              <Link
                href="/equipment"
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                  "hover:bg-accent/50 hover:text-accent-foreground",
                  location === "/equipment" 
                    ? "bg-accent/70 text-accent-foreground" 
                    : "transparent"
                )}
              >
                <Wrench className="mr-3 h-4 w-4" />
                Equipment
              </Link>
              
              <Link
                href="/operational-planning"
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                  "hover:bg-accent/50 hover:text-accent-foreground",
                  location === "/operational-planning" 
                    ? "bg-accent/70 text-accent-foreground" 
                    : "transparent"
                )}
              >
                <CalendarClock className="mr-3 h-4 w-4" />
                Operational Planning
              </Link>
              
              <Link
                href="/feedback"
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                  "hover:bg-accent/50 hover:text-accent-foreground",
                  location === "/feedback" 
                    ? "bg-accent/70 text-accent-foreground" 
                    : "transparent"
                )}
              >
                <MessageCircle className="mr-3 h-4 w-4" />
                Feedback & Issues
              </Link>
              
              {user?.role === "Admin" && (
                <Link
                  href="/settings"
                  className={cn(
                    "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                    "hover:bg-accent/50 hover:text-accent-foreground",
                    location === "/settings" 
                      ? "bg-accent/70 text-accent-foreground" 
                      : "transparent"
                  )}
                >
                  <Settings className="mr-3 h-4 w-4" />
                  Settings
                </Link>
              )}
            </nav>
            
            <Separator className="my-4 opacity-50" />
            
            {/* Live Metrics Section */}
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground tracking-wider">
                  Current Metrics
                </h3>
                
                <div className="space-y-3">
                  {/* Grid Power Metric */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium">Grid Power</span>
                      </div>
                      <span className="text-xs font-medium">
                        {powerData?.mainGridPower.toFixed(1) || "0.0"} kW
                      </span>
                    </div>
                    <Progress 
                      value={powerData ? Math.min(100, (powerData.mainGridPower / 10) * 100) : 0}
                      className="h-1" 
                    />
                  </div>
                  
                  {/* Solar Output Metric */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BatteryCharging className="h-3.5 w-3.5 text-accent" />
                        <span className="text-xs font-medium">Solar Output</span>
                      </div>
                      <span className="text-xs font-medium text-accent">
                        {powerData?.solarOutput ? powerData.solarOutput.toFixed(1) : "0.0"} kW
                      </span>
                    </div>
                    <Progress 
                      value={powerData ? Math.min(100, (powerData.solarOutput / 5) * 100) : 0}
                      className="h-1 bg-muted [&>div]:bg-accent" 
                    />
                  </div>
                  
                  {/* Total Load Metric */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-[#ff9f0c]" />
                        <span className="text-xs font-medium">Total Load</span>
                      </div>
                      <span className="text-xs font-medium text-[#ff9f0c]">
                        {powerData?.totalLoad ? powerData.totalLoad.toFixed(1) : "0.0"} kW
                      </span>
                    </div>
                    <Progress 
                      value={powerData ? Math.min(100, (powerData.totalLoad / 10) * 100) : 0}
                      className="h-1 bg-muted [&>div]:bg-[#ff9f0c]" 
                    />
                  </div>
                </div>
              </div>
              
              <Separator className="opacity-50" />
              
              {/* Environmental Data Section */}
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground tracking-wider">
                  Environmental Data
                </h3>
                
                <div className="rounded-lg border bg-card/40 p-3 shadow-sm">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs">Weather</span>
                      </div>
                      <span className="text-xs font-medium">
                        {environmentalData?.weather || "Unknown"}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3.5 w-3.5 flex items-center justify-center text-muted-foreground">
                          °C
                        </div>
                        <span className="text-xs">Temperature</span>
                      </div>
                      <span className="text-xs font-medium">
                        {environmentalData ? environmentalData.air_temp.toFixed(1) : "0"}°C
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs">Solar Radiation</span>
                      </div>
                      <span className="text-xs font-medium">
                        {environmentalData ? Math.round(environmentalData.ghi) : "0"} W/m²
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Collapse button for larger screens */}
          <div className="border-t p-4 hidden lg:block">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full" 
              onClick={onToggle}
            >
              Collapse
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
