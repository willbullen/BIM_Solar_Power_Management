import { useState } from "react";
import { usePowerData } from "@/hooks/use-power-data";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/ui/sidebar";
import { PowerChart } from "@/components/power-chart";
import { SummaryCards } from "@/components/metrics-card";
import { LoadDistribution } from "@/components/load-distribution";
import { InsightsCard } from "@/components/insights-card";
import { SolcastLiveCard } from "@/components/solcast-live-card";
import { EnvironmentalStats } from "@/components/environmental-chart";
import { Loader2, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

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
      
      {/* Solcast Live Data & Load Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Solcast Live Data */}
        <SolcastLiveCard />
        
        {/* Load Distribution */}
        <LoadDistribution powerData={powerData} />
      </div>
      
      {/* Environmental Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <EnvironmentalStats environmentalData={environmentalData} />
        
        {/* Insights Card */}
        <InsightsCard 
          powerData={powerData} 
          environmentalData={environmentalData} 
        />
      </div>
      
      {/* Forecasting Link */}
      <div className="flex justify-end mt-4">
        <Link href="/forecasting">
          <button className="flex items-center gap-2 bg-primary/20 hover:bg-primary/30 text-primary-foreground px-4 py-2 rounded-md transition">
            <TrendingUp className="w-4 h-4" />
            <span>View Power Forecasting</span>
          </button>
        </Link>
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
    <div className={`min-h-screen bg-background flex flex-col ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Header onToggleSidebar={toggleSidebar} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        
        <main className="flex-1 app-content p-4">
          <DashboardContent />
        </main>
      </div>
    </div>
  );
}
