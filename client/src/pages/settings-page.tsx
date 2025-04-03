import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PowerDataProvider, usePowerData } from "@/hooks/use-power-data";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Settings } from "@shared/schema";

function SettingsContent() {
  const { settings, isLoading } = usePowerData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Local state for form values
  const [formValues, setFormValues] = useState<Partial<Settings>>({
    dataSource: settings?.dataSource || 'live',
    scenarioProfile: settings?.scenarioProfile || 'sunny',
    gridImportThreshold: settings?.gridImportThreshold || 5,
    solarOutputMinimum: settings?.solarOutputMinimum || 1.5,
    unaccountedPowerThreshold: settings?.unaccountedPowerThreshold || 15,
    enableEmailNotifications: settings?.enableEmailNotifications || true,
    dataRefreshRate: settings?.dataRefreshRate || 10,
    historicalDataStorage: settings?.historicalDataStorage || 90,
    gridPowerCost: settings?.gridPowerCost || 0.28,
    feedInTariff: settings?.feedInTariff || 0.09,
    // API Keys
    weatherApiKey: settings?.weatherApiKey || '',
    powerMonitoringApiKey: settings?.powerMonitoringApiKey || '',
    notificationsApiKey: settings?.notificationsApiKey || '',
  });
  
  // Update local state when settings load from the server
  useEffect(() => {
    if (settings) {
      setFormValues(settings);
    }
  }, [settings]);
  
  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<Settings>) => {
      const res = await apiRequest("PUT", "/api/settings", updatedSettings);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle form input changes
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
      setFormValues({
        ...formValues,
        [name]: parseFloat(value),
      });
    } else {
      setFormValues({
        ...formValues,
        [name]: value,
      });
    }
  };
  
  // Handle switch changes
  const handleSwitchChange = (checked: boolean, name: string) => {
    setFormValues({
      ...formValues,
      [name]: checked,
    });
  };
  
  // Handle radio button changes
  const handleRadioChange = (value: string, name: string) => {
    setFormValues({
      ...formValues,
      [name]: value,
    });
  };
  
  // Handle form submission
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveSettingsMutation.mutate(formValues);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-white">System Settings</h1>
          <p className="text-muted-foreground">Configure monitoring system parameters</p>
        </div>
        
        <div className="mt-3 md:mt-0">
          <Button 
            onClick={handleSubmit}
            disabled={saveSettingsMutation.isPending}
          >
            {saveSettingsMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Data Source Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Data Source</CardTitle>
              <CardDescription>Configure how data is received and processed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup 
                value={formValues.dataSource} 
                onValueChange={(value) => handleRadioChange(value, "dataSource")}
                className="space-y-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="live" id="live" />
                  <div className="grid gap-1.5">
                    <Label htmlFor="live" className="flex items-center">
                      <span>Live Data</span>
                      <span className="status-badge live ml-2">Connected</span>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Use real-time data from the on-site Emporium power monitoring system
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="synthetic" id="synthetic" />
                  <div className="grid gap-1.5">
                    <Label htmlFor="synthetic" className="flex items-center">
                      <span>Synthetic Data</span>
                      <span className="status-badge synthetic ml-2">Demo Mode</span>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Use simulated data for testing and demonstration purposes
                    </p>
                  </div>
                </div>
              </RadioGroup>
              
              {formValues.dataSource === "synthetic" && (
                <div className="ml-7 mt-5 space-y-4">
                  <p className="text-white font-medium">Select Scenario Profile:</p>
                  
                  <RadioGroup 
                    value={formValues.scenarioProfile} 
                    onValueChange={(value) => handleRadioChange(value, "scenarioProfile")}
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sunny" id="sunny" />
                      <div className="grid gap-1">
                        <Label htmlFor="sunny" className="font-medium">Sunny High PV</Label>
                        <p className="text-xs text-muted-foreground">
                          Max solar generation, low grid import
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cloudy" id="cloudy" />
                      <div className="grid gap-1">
                        <Label htmlFor="cloudy" className="font-medium">Cloudy Low PV</Label>
                        <p className="text-xs text-muted-foreground">
                          Reduced solar output, higher grid reliance
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="peak" id="peak" />
                      <div className="grid gap-1">
                        <Label htmlFor="peak" className="font-medium">Peak Load</Label>
                        <p className="text-xs text-muted-foreground">
                          Maximum consumption across all systems
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="night" id="night" />
                      <div className="grid gap-1">
                        <Label htmlFor="night" className="font-medium">Night Operation</Label>
                        <p className="text-xs text-muted-foreground">
                          No solar, minimal activity except refrigeration
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Alert Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Alert Configuration</CardTitle>
              <CardDescription>Set thresholds for system notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="gridImportThreshold">Grid Import Threshold (kW)</Label>
                <Input 
                  id="gridImportThreshold"
                  name="gridImportThreshold"
                  type="number"
                  min={0}
                  step={0.5}
                  value={formValues.gridImportThreshold}
                  onChange={handleChange}
                />
                <p className="text-xs text-muted-foreground">
                  Alert when grid power import exceeds this value
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="solarOutputMinimum">Solar Output Minimum (kW)</Label>
                <Input 
                  id="solarOutputMinimum"
                  name="solarOutputMinimum"
                  type="number"
                  min={0}
                  step={0.1}
                  value={formValues.solarOutputMinimum}
                  onChange={handleChange}
                />
                <p className="text-xs text-muted-foreground">
                  Alert when solar output falls below expected minimum during daylight
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="unaccountedPowerThreshold">Unaccounted Power Threshold (%)</Label>
                <Input 
                  id="unaccountedPowerThreshold"
                  name="unaccountedPowerThreshold"
                  type="number"
                  min={0}
                  max={100}
                  value={formValues.unaccountedPowerThreshold}
                  onChange={handleChange}
                />
                <p className="text-xs text-muted-foreground">
                  Alert when unaccounted power exceeds this percentage of total
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="enableEmailNotifications"
                  checked={formValues.enableEmailNotifications}
                  onCheckedChange={(checked) => 
                    handleSwitchChange(checked, "enableEmailNotifications")
                  }
                />
                <Label htmlFor="enableEmailNotifications">Enable Email Notifications</Label>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* System Parameters */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>System Parameters</CardTitle>
            <CardDescription>Advanced configuration settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dataRefreshRate">Data Refresh Rate (seconds)</Label>
                <Input 
                  id="dataRefreshRate"
                  name="dataRefreshRate"
                  type="number"
                  min={5}
                  max={3600}
                  value={formValues.dataRefreshRate}
                  onChange={handleChange}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="historicalDataStorage">Historical Data Storage (days)</Label>
                <Input 
                  id="historicalDataStorage"
                  name="historicalDataStorage"
                  type="number"
                  min={1}
                  max={365}
                  value={formValues.historicalDataStorage}
                  onChange={handleChange}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="gridPowerCost">Grid Power Cost (€/kWh)</Label>
                <Input 
                  id="gridPowerCost"
                  name="gridPowerCost"
                  type="number"
                  min={0}
                  step={0.01}
                  value={formValues.gridPowerCost}
                  onChange={handleChange}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="feedInTariff">Feed-in Tariff (€/kWh)</Label>
                <Input 
                  id="feedInTariff"
                  name="feedInTariff"
                  type="number"
                  min={0}
                  step={0.01}
                  value={formValues.feedInTariff}
                  onChange={handleChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* API Keys */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>Configure external service integrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="weatherApiKey">Weather API Key</Label>
                <Input 
                  id="weatherApiKey"
                  name="weatherApiKey"
                  type="password"
                  value={formValues.weatherApiKey || ''}
                  onChange={handleChange}
                  placeholder="Enter your weather service API key"
                />
                <p className="text-xs text-muted-foreground">
                  Used for retrieving real-time weather data for correlation analysis
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="powerMonitoringApiKey">Power Monitoring API Key</Label>
                <Input 
                  id="powerMonitoringApiKey"
                  name="powerMonitoringApiKey"
                  type="password"
                  value={formValues.powerMonitoringApiKey || ''}
                  onChange={handleChange}
                  placeholder="Enter your power monitoring system API key"
                />
                <p className="text-xs text-muted-foreground">
                  Used to connect to on-site power monitoring hardware for live data
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="notificationsApiKey">Notifications API Key</Label>
                <Input 
                  id="notificationsApiKey"
                  name="notificationsApiKey"
                  type="password"
                  value={formValues.notificationsApiKey || ''}
                  onChange={handleChange}
                  placeholder="Enter your notifications service API key"
                />
                <p className="text-xs text-muted-foreground">
                  Used for sending alerts and notifications via SMS or push services
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

export default function SettingsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  return (
    <PowerDataProvider>
      <div className={`min-h-screen bg-background flex flex-col ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header onToggleSidebar={toggleSidebar} />
        
        <div className="flex flex-1 overflow-hidden">
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
          
          <main className="flex-1 app-content p-4">
            <SettingsContent />
          </main>
        </div>
      </div>
    </PowerDataProvider>
  );
}
