import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { Layout } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Settings, Users, Zap, CloudSun, Palette, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define schema for settings form
const settingsSchema = z.object({
  scenarioProfile: z.string(),
  dataSource: z.string(),
  processingInterval: z.number().min(1).max(60),
  powerAlertThreshold: z.number().min(10),
  solarAlertThreshold: z.number().min(5),
  anomalyDetectionEnabled: z.boolean(),
  forecastingEnabled: z.boolean(),
});

// Define schema for Solcast settings
const solcastSchema = z.object({
  apiKey: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  capacity: z.number().min(1),
  tilt: z.number().min(0).max(90),
  azimuth: z.number().min(0).max(360),
});

// Define schema for user settings
const userSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(data => {
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
}, {
  message: "Current password is required when setting a new password",
  path: ["currentPassword"],
}).refine(data => {
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Define schema for appearance settings
const appearanceSchema = z.object({
  theme: z.string(),
  sidebarCollapsed: z.boolean(),
  chartAnimations: z.boolean(),
  dashboardLayout: z.string(),
});

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  
  // Fetch current settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });
  
  // Fetch current user data
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['/api/user'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });
  
  // Fetch Solcast settings
  const { data: solcastSettings, isLoading: isLoadingSolcast } = useQuery({
    queryKey: ['/api/settings/solcast'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });
  
  // Create form for general settings
  const generalForm = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      scenarioProfile: "standard",
      dataSource: "live",
      processingInterval: 5,
      powerAlertThreshold: 50,
      solarAlertThreshold: 20,
      anomalyDetectionEnabled: true,
      forecastingEnabled: true,
    },
  });
  
  // Create form for Solcast settings
  const solcastForm = useForm<z.infer<typeof solcastSchema>>({
    resolver: zodResolver(solcastSchema),
    defaultValues: {
      apiKey: "",
      latitude: 52.059937,
      longitude: -9.507269,
      capacity: 25,
      tilt: 30,
      azimuth: 180,
    },
  });
  
  // Create form for user settings
  const userForm = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "",
      email: "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  // Create form for appearance settings
  const appearanceForm = useForm<z.infer<typeof appearanceSchema>>({
    resolver: zodResolver(appearanceSchema),
    defaultValues: {
      theme: "dark",
      sidebarCollapsed: false,
      chartAnimations: true,
      dashboardLayout: "standard",
    },
  });
  
  // Set form values when data is loaded
  useEffect(() => {
    if (settings) {
      generalForm.reset({
        scenarioProfile: settings.scenarioProfile,
        dataSource: settings.dataSource,
        processingInterval: settings.processingInterval,
        powerAlertThreshold: settings.powerAlertThreshold,
        solarAlertThreshold: settings.solarAlertThreshold,
        anomalyDetectionEnabled: settings.anomalyDetectionEnabled,
        forecastingEnabled: settings.forecastingEnabled,
      });
    }
  }, [settings, generalForm]);
  
  useEffect(() => {
    if (solcastSettings) {
      solcastForm.reset({
        apiKey: solcastSettings.apiKey || "",
        latitude: solcastSettings.latitude,
        longitude: solcastSettings.longitude,
        capacity: solcastSettings.capacity,
        tilt: solcastSettings.tilt,
        azimuth: solcastSettings.azimuth,
      });
    }
  }, [solcastSettings, solcastForm]);
  
  useEffect(() => {
    if (user) {
      userForm.reset({
        username: user.username,
        email: user.email || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }
  }, [user, userForm]);
  
  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: z.infer<typeof settingsSchema>) => {
      return await apiRequest('/api/settings', {
        method: 'POST',
        data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Settings updated",
        description: "Your changes have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save settings",
        description: error.message || "There was an error saving your settings.",
        variant: "destructive",
      });
    },
  });
  
  // Save Solcast settings mutation
  const saveSolcastMutation = useMutation({
    mutationFn: async (data: z.infer<typeof solcastSchema>) => {
      return await apiRequest('/api/settings/solcast', {
        method: 'POST',
        data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Solcast settings updated",
        description: "Your changes have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/solcast'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save Solcast settings",
        description: error.message || "There was an error saving your settings.",
        variant: "destructive",
      });
    },
  });
  
  // Save user settings mutation
  const saveUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userSchema>) => {
      return await apiRequest('/api/user', {
        method: 'POST',
        data,
      });
    },
    onSuccess: () => {
      toast({
        title: "User settings updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      // Clear password fields
      userForm.setValue("currentPassword", "");
      userForm.setValue("newPassword", "");
      userForm.setValue("confirmPassword", "");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update profile",
        description: error.message || "There was an error updating your profile.",
        variant: "destructive",
      });
    },
  });
  
  // Save appearance settings mutation
  const saveAppearanceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof appearanceSchema>) => {
      return await apiRequest('/api/settings/appearance', {
        method: 'POST',
        data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Appearance settings updated",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save appearance settings",
        description: error.message || "There was an error saving your settings.",
        variant: "destructive",
      });
    },
  });
  
  // Form submission handlers
  const onSubmitGeneralSettings = (data: z.infer<typeof settingsSchema>) => {
    saveSettingsMutation.mutate(data);
  };
  
  const onSubmitSolcastSettings = (data: z.infer<typeof solcastSchema>) => {
    saveSolcastMutation.mutate(data);
  };
  
  const onSubmitUserSettings = (data: z.infer<typeof userSchema>) => {
    saveUserMutation.mutate(data);
  };
  
  const onSubmitAppearanceSettings = (data: z.infer<typeof appearanceSchema>) => {
    saveAppearanceMutation.mutate(data);
    
    // Apply theme change immediately
    document.documentElement.classList.toggle("dark", data.theme === "dark");
  };
  
  return (
    <Layout title="Settings" description="Configure system settings and preferences">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full md:w-fit">
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="solcast">
            <CloudSun className="h-4 w-4 mr-2" />
            Solcast API
          </TabsTrigger>
          <TabsTrigger value="user">
            <Users className="h-4 w-4 mr-2" />
            User Profile
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 mr-2" />
            Appearance
          </TabsTrigger>
        </TabsList>
        
        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure basic application settings and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSettings ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Form {...generalForm}>
                  <form 
                    onSubmit={generalForm.handleSubmit(onSubmitGeneralSettings)} 
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={generalForm.control}
                        name="dataSource"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data Source</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select data source" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="live">Live Data</SelectItem>
                                <SelectItem value="historical">Historical Data</SelectItem>
                                <SelectItem value="synthetic">Synthetic Data</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Choose the source of power and environmental data
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={generalForm.control}
                        name="scenarioProfile"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Scenario Profile</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select scenario" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="standard">Standard Profile</SelectItem>
                                <SelectItem value="peakDemand">Peak Demand</SelectItem>
                                <SelectItem value="reducedLoad">Reduced Load</SelectItem>
                                <SelectItem value="solarOptimized">Solar Optimized</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Configure model behavior for synthetic data
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={generalForm.control}
                        name="processingInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Processing Interval (minutes)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={1} 
                                max={60} 
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              How often to fetch and process new data
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={generalForm.control}
                        name="powerAlertThreshold"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Power Alert Threshold (kW)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={10} 
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Threshold for power consumption alerts
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={generalForm.control}
                        name="solarAlertThreshold"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Solar Alert Threshold (kW)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={5} 
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Threshold for solar production alerts
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={generalForm.control}
                          name="anomalyDetectionEnabled"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Anomaly Detection</FormLabel>
                                <FormDescription>
                                  Enable automated detection of unusual power patterns
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={generalForm.control}
                          name="forecastingEnabled"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Power Forecasting</FormLabel>
                                <FormDescription>
                                  Enable predictive power consumption forecasting
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={!generalForm.formState.isDirty || saveSettingsMutation.isPending}
                    >
                      {saveSettingsMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save Settings
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Solcast API Settings */}
        <TabsContent value="solcast">
          <Card>
            <CardHeader>
              <CardTitle>Solcast API Configuration</CardTitle>
              <CardDescription>
                Configure settings for solar radiation and weather data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSolcast ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Form {...solcastForm}>
                  <form 
                    onSubmit={solcastForm.handleSubmit(onSubmitSolcastSettings)} 
                    className="space-y-6"
                  >
                    <Alert className="mb-6">
                      <Globe className="h-4 w-4" />
                      <AlertTitle>Solcast API Integration</AlertTitle>
                      <AlertDescription>
                        Solcast provides solar radiation and weather data for accurate forecasting. 
                        Your API key is required for live data access.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={solcastForm.control}
                        name="apiKey"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Solcast API Key</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormDescription>
                              Your Solcast API key for authentication
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={solcastForm.control}
                        name="latitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Latitude</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.000001" 
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Facility location latitude (decimal degrees)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={solcastForm.control}
                        name="longitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Longitude</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.000001" 
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Facility location longitude (decimal degrees)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={solcastForm.control}
                        name="capacity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>System Capacity (kW)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={1} 
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Solar system capacity in kilowatts
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={solcastForm.control}
                        name="tilt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Panel Tilt (degrees)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={0} 
                                max={90} 
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Solar panel tilt angle from horizontal
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={solcastForm.control}
                        name="azimuth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Panel Azimuth (degrees)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={0} 
                                max={360} 
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Solar panel orientation (180° = South)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={!solcastForm.formState.isDirty || saveSolcastMutation.isPending}
                    >
                      {saveSolcastMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save Solcast Settings
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* User Profile Settings */}
        <TabsContent value="user">
          <Card>
            <CardHeader>
              <CardTitle>User Profile</CardTitle>
              <CardDescription>
                Manage your account and profile settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUser ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Form {...userForm}>
                  <form 
                    onSubmit={userForm.handleSubmit(onSubmitUserSettings)} 
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={userForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormDescription>
                              Your display name on the platform
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={userForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormDescription>
                              Your email for notifications and alerts
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="space-y-4 border rounded-lg p-4 mt-8">
                      <h3 className="text-lg font-medium">Change Password</h3>
                      <p className="text-sm text-muted-foreground">
                        Update your password to maintain account security
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <FormField
                          control={userForm.control}
                          name="currentPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Current Password</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={userForm.control}
                            name="newPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <FormControl>
                                  <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={userForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Confirm New Password</FormLabel>
                                <FormControl>
                                  <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={!userForm.formState.isDirty || saveUserMutation.isPending}
                    >
                      {saveUserMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save Profile
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Appearance Settings */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the application interface and display options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...appearanceForm}>
                <form 
                  onSubmit={appearanceForm.handleSubmit(onSubmitAppearanceSettings)} 
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={appearanceForm.control}
                      name="theme"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Theme</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select theme" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="dark">Dark</SelectItem>
                              <SelectItem value="system">System Default</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose your preferred color theme
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={appearanceForm.control}
                      name="dashboardLayout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dashboard Layout</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select layout" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="compact">Compact</SelectItem>
                              <SelectItem value="expanded">Expanded</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Configure the dashboard component layout
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={appearanceForm.control}
                      name="sidebarCollapsed"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Sidebar Collapsed by Default</FormLabel>
                            <FormDescription>
                              Start with a collapsed sidebar for more screen space
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={appearanceForm.control}
                      name="chartAnimations"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Chart Animations</FormLabel>
                            <FormDescription>
                              Enable smooth animations in charts and graphs
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={!appearanceForm.formState.isDirty || saveAppearanceMutation.isPending}
                  >
                    {saveAppearanceMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Appearance
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}