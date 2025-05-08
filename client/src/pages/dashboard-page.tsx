import { useState } from "react";
import { usePowerData } from "@/hooks/use-power-data";
import { useAuth } from "@/hooks/use-auth";
import { PowerChart } from "@/components/power-chart";
import { LoadDistribution } from "@/components/load-distribution";
import { InsightsCard } from "@/components/insights-card";
import { SolcastLiveCard } from "@/components/solcast-live-card";
import { AIEnergyRecommendations } from "@/components/ai-energy-recommendations";
import { EnvironmentalStats } from "@/components/environmental-chart";
import { Loader2, TrendingUp, ArrowRight, BarChart3, Zap, Sun, CloudSun, Thermometer } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SharedLayout from "@/components/ui/shared-layout";
import { StatCard } from "@/components/ui/stat-card";

function DashboardPage() {
  // Debug message to verify this component is being used
  console.log("*** DEBUG: Loading dashboard-page-NEW.tsx - UPDATED VERSION ***");
  
  const { 
    powerData, 
    environmentalData, 
    historicalPowerData, 
    isLoading, 
    lastUpdated,
    dataStatus 
  } = usePowerData();
  
  const { user } = useAuth();
  
  if (isLoading) {
    return (
      <SharedLayout user={user}>
        <div className="flex items-center justify-center h-[calc(100vh-16rem)]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading power data...</p>
          </div>
        </div>
      </SharedLayout>
    );
  }
  
  // Get the latest data
  const latestPower = Array.isArray(powerData) && powerData.length > 0 ? powerData[powerData.length - 1] : null;
  const previousPower = Array.isArray(powerData) && powerData.length > 1 ? powerData[powerData.length - 2] : latestPower;
  
  // Calculate trends
  const totalLoadTrend = latestPower && previousPower ? 
    ((latestPower.totalLoad - previousPower.totalLoad) / previousPower.totalLoad) * 100 : 0;
  
  const mainGridTrend = latestPower && previousPower && previousPower.mainGridPower > 0 ? 
    ((latestPower.mainGridPower - previousPower.mainGridPower) / previousPower.mainGridPower) * 100 : 0;
  
  const solarOutputTrend = latestPower && previousPower && previousPower.solarOutput > 0 ? 
    ((latestPower.solarOutput - previousPower.solarOutput) / previousPower.solarOutput) * 100 : 0;
  
  const getEfficiencyFormatted = () => {
    if (!latestPower) return '0%';
    if (latestPower.totalLoad === 0) return 'N/A';
    
    const solarRatio = (latestPower.solarOutput / latestPower.totalLoad) * 100;
    return `${solarRatio.toFixed(1)}%`;
  };
  
  return (
    <SharedLayout user={user}>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">
              UPDATED VERSION
            </Badge>
            <Badge variant={dataStatus === 'live' ? 'default' : 'outline'}>
              {dataStatus === 'live' ? 'Live Data' : 'Historical'}
            </Badge>
            {lastUpdated && (
              <p className="text-sm text-muted-foreground">
                Last updated: {format(new Date(lastUpdated), 'HH:mm:ss')}
              </p>
            )}
          </div>
          
          <div className="mt-2 sm:mt-0 flex items-center gap-2">
            <AIEnergyRecommendations />
            <Button variant="outline" size="sm" asChild>
              <Link href="/forecasting">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Forecasts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
        
        {/* Main stats cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Load"
            value={latestPower ? `${latestPower.totalLoad.toFixed(2)} kW` : '0 kW'}
            description="Real-time power consumption"
            icon={Zap}
            trend={latestPower ? { value: totalLoadTrend, positive: totalLoadTrend > 0 } : undefined}
          />
          
          <StatCard
            title="Main Grid Power"
            value={latestPower ? `${latestPower.mainGridPower.toFixed(2)} kW` : '0 kW'}
            description="Power drawn from the grid"
            icon={BarChart3}
            trend={latestPower ? { value: mainGridTrend, positive: mainGridTrend > 0 } : undefined}
          />
          
          <StatCard
            title="Solar Output"
            value={latestPower ? `${latestPower.solarOutput.toFixed(2)} kW` : '0 kW'}
            description="Current solar generation"
            icon={Sun}
            trend={latestPower ? { value: solarOutputTrend, positive: solarOutputTrend > 0 } : undefined}
          />
          
          <StatCard
            title="Solar Efficiency"
            value={getEfficiencyFormatted()}
            description="% of power from solar"
            icon={CloudSun}
          />
        </div>
        
        {/* Main content tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="power">Power Analysis</TabsTrigger>
            <TabsTrigger value="environment">Environment</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="md:col-span-2 bg-card rounded-lg border border-border shadow-md overflow-hidden">
                <CardHeader className="p-4 border-b border-border">
                  <div className="flex items-center space-x-1">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-medium">Power Usage Overview</CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Real-time monitoring of power consumption and generation
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="w-full h-full">
                    <PowerChart 
                      data={historicalPowerData && historicalPowerData.length > 0 ? historicalPowerData.slice(-48) : []} 
                      className="min-h-[340px]"
                    />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-card rounded-lg border border-border shadow-md">
                <CardHeader className="p-4 border-b border-border">
                  <div className="flex items-center space-x-1">
                    <Zap className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-medium">Load Distribution</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Current power allocation by source</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <LoadDistribution data={latestPower || null} className="h-[280px]" />
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="bg-card rounded-lg border border-border shadow-md">
                <CardHeader className="p-4 border-b border-border">
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-medium">Operational Insights</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Key recommendations based on current conditions</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {latestPower && environmentalData ? (
                    <InsightsCard powerData={latestPower} environmentalData={environmentalData} />
                  ) : (
                    <div className="flex flex-col items-center justify-center min-h-[260px] p-6 space-y-4">
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-muted/10">
                        <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
                      </div>
                      <p className="text-base text-muted-foreground/70">No operational data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card className="bg-card rounded-lg border border-border shadow-md">
                <CardHeader className="p-4 border-b border-border">
                  <div className="flex items-center space-x-1">
                    <CloudSun className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-medium">Weather Conditions</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Current environmental factors</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {environmentalData ? (
                    <EnvironmentalStats environmentalData={environmentalData ? [environmentalData] : []} />
                  ) : (
                    <div className="flex flex-col items-center justify-center min-h-[260px] p-6 space-y-4">
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-muted/10">
                        <CloudSun className="h-10 w-10 text-muted-foreground/40" />
                      </div>
                      <p className="text-base text-muted-foreground/70">No environmental data available</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-end p-4 pt-0">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/reports">
                      View detailed reports
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="power" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="md:col-span-2 bg-card rounded-lg border border-border shadow-md overflow-hidden">
                <CardHeader className="p-4 border-b border-border">
                  <div className="flex items-center space-x-1">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-medium">Detailed Power Analysis</CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Comprehensive view of power trends and patterns
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="w-full h-full">
                    <PowerChart 
                      data={historicalPowerData && historicalPowerData.length > 0 ? historicalPowerData.slice(-96) : []} 
                      showProcessLoad={true}
                      showLighting={true}
                      showHvac={true}
                      showRefrigeration={true}
                      className="min-h-[400px]"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="bg-card rounded-lg border border-border shadow-md">
                <CardHeader className="p-4 border-b border-border">
                  <div className="flex items-center space-x-1">
                    <Zap className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-medium">Process Load</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Manufacturing operations</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {latestPower ? (
                    <>
                      <div className="text-2xl font-bold mb-1">
                        {latestPower.processLoad.toFixed(2)} kW
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {latestPower && previousPower ? (
                          <>
                            {latestPower.processLoad > previousPower.processLoad ? 'Increased' : 'Decreased'} by{' '}
                            {Math.abs(latestPower.processLoad - previousPower.processLoad).toFixed(2)} kW
                          </>
                        ) : 'No trend data available'}
                      </p>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center min-h-[150px] p-6 space-y-4">
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-muted/10">
                        <Zap className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                      <p className="text-base text-muted-foreground/70">No process load data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card className="bg-card rounded-lg border border-border shadow-md">
                <CardHeader className="p-4 border-b border-border">
                  <div className="flex items-center space-x-1">
                    <Thermometer className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-medium">HVAC Systems</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Heating and cooling</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {latestPower ? (
                    <>
                      <div className="text-2xl font-bold mb-1">
                        {latestPower.hvacLoad.toFixed(2)} kW
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {latestPower && previousPower ? (
                          <>
                            {latestPower.hvacLoad > previousPower.hvacLoad ? 'Increased' : 'Decreased'} by{' '}
                            {Math.abs(latestPower.hvacLoad - previousPower.hvacLoad).toFixed(2)} kW
                          </>
                        ) : 'No trend data available'}
                      </p>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center min-h-[150px] p-6 space-y-4">
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-muted/10">
                        <Thermometer className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                      <p className="text-base text-muted-foreground/70">No HVAC data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card className="bg-card rounded-lg border border-border shadow-md">
                <CardHeader className="p-4 border-b border-border">
                  <div className="flex items-center space-x-1">
                    <CloudSun className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-medium">Refrigeration</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Cold storage systems</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {latestPower ? (
                    <>
                      <div className="text-2xl font-bold mb-1">
                        {latestPower.refrigerationLoad.toFixed(2)} kW
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {latestPower && previousPower ? (
                          <>
                            {latestPower.refrigerationLoad > previousPower.refrigerationLoad ? 'Increased' : 'Decreased'} by{' '}
                            {Math.abs(latestPower.refrigerationLoad - previousPower.refrigerationLoad).toFixed(2)} kW
                          </>
                        ) : 'No trend data available'}
                      </p>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center min-h-[150px] p-6 space-y-4">
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-muted/10">
                        <CloudSun className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                      <p className="text-base text-muted-foreground/70">No refrigeration data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="environment" className="space-y-4">
            <Card className="bg-card rounded-lg border border-border shadow-md">
              <CardHeader className="p-4 border-b border-border">
                <div className="flex items-center space-x-1">
                  <Sun className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-medium">Environmental Conditions & Solar Production</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Weather metrics and their impact on solar generation
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {environmentalData ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <EnvironmentalStats environmentalData={environmentalData ? [environmentalData] : []} />
                    </div>
                    <div>
                      <SolcastLiveCard />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[300px] p-6 space-y-4">
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-muted/10">
                      <Sun className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                    <p className="text-base text-muted-foreground/70">No environmental data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SharedLayout>
  );
}

export default DashboardPage;