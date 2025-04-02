import { useState } from "react";
import { PowerDataProvider, usePowerData } from "@/hooks/use-power-data";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/ui/sidebar";
import { PowerChart } from "@/components/power-chart";
import { SummaryCards } from "@/components/metrics-card";
import { LoadDistribution } from "@/components/load-distribution";
import { InsightsCard } from "@/components/insights-card";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

function DashboardContent() {
  const { 
    powerData, 
    environmentalData, 
    historicalPowerData, 
    isLoading, 
    lastUpdated,
    dataStatus 
  } = usePowerData();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading power data...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-white">Power Monitoring Dashboard</h1>
          <p className="text-muted-foreground">Dalys Seafood Facility - Real-time monitoring</p>
        </div>
        
        <div className="mt-3 md:mt-0 flex items-center">
          <div className="mr-4">
            <span className="text-sm text-muted-foreground">Data Status:</span>
            <span className={`ml-2 px-2 py-1 text-xs rounded-full status-badge ${dataStatus}`}>
              {dataStatus === 'live' ? 'Live' : dataStatus === 'synthetic' ? 'Synthetic' : 'Offline'}
            </span>
          </div>
          
          {lastUpdated && (
            <div>
              <span className="text-sm text-muted-foreground">Last Update:</span>
              <span className="ml-2 text-white">{format(lastUpdated, 'HH:mm:ss')}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Summary Cards */}
      <SummaryCards powerData={powerData} />
      
      {/* Power Usage Timeline */}
      <PowerChart powerData={historicalPowerData} />
      
      {/* Load Distribution & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Load Distribution */}
        <div className="lg:col-span-2">
          <LoadDistribution powerData={powerData} />
        </div>
        
        {/* Insights Card */}
        <div>
          <InsightsCard 
            powerData={powerData} 
            environmentalData={environmentalData} 
          />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  return (
    <PowerDataProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <Header onToggleSidebar={toggleSidebar} />
        
        <div className="flex flex-1 overflow-hidden">
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
          
          <main className={`flex-1 app-content p-4 ${sidebarCollapsed ? '' : 'lg:ml-64'}`}>
            <DashboardContent />
          </main>
        </div>
      </div>
    </PowerDataProvider>
  );
}
