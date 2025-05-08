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
import { Loader2, TrendingUp, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading power data...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      {/* Page Title and Info */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Power Monitoring Dashboard</h1>
            <p className="text-muted-foreground mt-1">Dalys Seafood Facility - Real-time monitoring</p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge variant={dataStatus === 'live' ? "default" : dataStatus === 'synthetic' ? "secondary" : "outline"}>
                {dataStatus === 'live' ? 'Live' : dataStatus === 'synthetic' ? 'Synthetic' : 'Offline'}
              </Badge>
            </div>
            
            {lastUpdated && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Updated:</span>
                <span className="text-sm font-medium">{format(lastUpdated, 'HH:mm:ss')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Summary Cards */}
      <SummaryCards powerData={powerData} />
      
      {/* Power Usage Timeline */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Power Usage Timeline</h2>
          <Badge variant="outline" className="text-xs">Last 24 Hours</Badge>
        </div>
        <PowerChart powerData={historicalPowerData} />
      </div>
      
      {/* Solcast Live Data & Load Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Solcast Live Data */}
        <SolcastLiveCard />
        
        {/* Load Distribution */}
        <LoadDistribution powerData={powerData} />
      </div>
      
      {/* Environmental Statistics & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnvironmentalStats environmentalData={environmentalData} />
        
        {/* Insights Card */}
        <InsightsCard 
          powerData={powerData} 
          environmentalData={environmentalData} 
        />
      </div>
      
      {/* Forecasting Link */}
      <div className="flex justify-end mt-8">
        <Link href="/forecasting">
          <Button variant="outline" className="group">
            View Power Forecasting
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
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
    <>
      <Header onToggleSidebar={toggleSidebar} />
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <Page>
        <DashboardContent />
      </Page>
    </>
  );
}
