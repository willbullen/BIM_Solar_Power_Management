import { cn } from "@/lib/utils";
import { useState, ReactNode } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePowerData } from "@/hooks/use-power-data";
import { 
  Zap, 
  BarChart3, 
  Settings, 
  Sun, 
  Thermometer, 
  CloudSun
} from "lucide-react";

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
        "app-sidebar",
        collapsed ? "-translate-x-full" : "translate-x-0"
      )}>
        <div className="px-4 py-4">
          <div className="mb-6">
            <p className="text-xs uppercase text-muted-foreground font-semibold tracking-wider mb-2">
              Navigation
            </p>
            
            {/* Sidebar Menu */}
            <nav className="space-y-1">
              <Link href="/dashboard">
                <a className={cn(
                  "sidebar-menu-item",
                  (location === "/" || location === "/dashboard") && "active"
                )}>
                  <BarChart3 className="sidebar-menu-item-icon" />
                  <span>Dashboard</span>
                </a>
              </Link>
              
              {user?.role === "Admin" && (
                <Link href="/settings">
                  <a className={cn(
                    "sidebar-menu-item",
                    location === "/settings" && "active"
                  )}>
                    <Settings className="sidebar-menu-item-icon" />
                    <span>Settings</span>
                  </a>
                </Link>
              )}
            </nav>
          </div>
          
          {/* Current Metrics */}
          <div className="mb-6">
            <p className="text-xs uppercase text-muted-foreground font-semibold tracking-wider mb-2">
              Current Metrics
            </p>
            
            <div className="bg-card/50 rounded-md p-3 mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-muted-foreground text-sm">Grid Power</span>
                <span className="text-white">{powerData?.mainGridPower.toFixed(1) || "0.0"} kW</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary" 
                  style={{ 
                    width: powerData 
                      ? `${Math.min(100, (powerData.mainGridPower / 10) * 100)}%` 
                      : "0%" 
                  }}
                />
              </div>
            </div>
            
            <div className="bg-card/50 rounded-md p-3 mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-muted-foreground text-sm">Solar Output</span>
                <span className="text-accent">{powerData?.solarOutput.toFixed(1) || "0.0"} kW</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent" 
                  style={{ 
                    width: powerData 
                      ? `${Math.min(100, (powerData.solarOutput / 5) * 100)}%` 
                      : "0%" 
                  }}
                />
              </div>
            </div>
            
            <div className="bg-card/50 rounded-md p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-muted-foreground text-sm">Total Load</span>
                <span className="text-[#ff9f0c]">{powerData?.totalLoad.toFixed(1) || "0.0"} kW</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#ff9f0c]" 
                  style={{ 
                    width: powerData 
                      ? `${Math.min(100, (powerData.totalLoad / 10) * 100)}%` 
                      : "0%" 
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Environmental Data */}
          <div>
            <p className="text-xs uppercase text-muted-foreground font-semibold tracking-wider mb-2">
              Environment
            </p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Weather</span>
                <span className="text-white">{environmentalData?.weather || "Unknown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Temperature</span>
                <span className="text-white">
                  {environmentalData ? environmentalData.temperature.toFixed(1) : "0"}°C
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Sun Intensity</span>
                <span className="text-white">
                  {environmentalData ? environmentalData.sunIntensity.toFixed(0) : "0"}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
