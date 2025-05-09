import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { SharedLayout } from "@/components/ui/shared-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Send, Settings, Users, Zap, CloudSun, Palette, Globe, BugPlay, MessageSquare, MessageCircle, Check, AlertTriangle, Info } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreateTestNotificationButton } from "@/components/create-test-notification-button";

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

// Import Telegram schemas
import { 
  telegramBotSchema, 
  telegramPreferencesSchema, 
  telegramTestMessageSchema,
  type TelegramBotSettings,
  type TelegramPreferences
} from "@/lib/telegram-schemas";

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
  
  // Fetch Telegram settings (for admin only)
  const { data: telegramSettings, isLoading: isLoadingTelegram } = useQuery({
    queryKey: ['/api/telegram/settings'],
    queryFn: getQueryFn({ on401: 'ignore' }),
    enabled: user?.role === 'Admin', // Only fetch if user is admin
  });
  
  // Fetch user's Telegram connection status
  const { data: telegramStatus, isLoading: isLoadingTelegramStatus } = useQuery({
    queryKey: ['/api/telegram/status'],
    queryFn: getQueryFn({ on401: 'ignore' }),
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
  
  // Create form for Telegram bot settings (admin only)
  const telegramBotForm = useForm<z.infer<typeof telegramBotSchema>>({
    resolver: zodResolver(telegramBotSchema),
    defaultValues: {
      botToken: "",
      botUsername: "",
      isEnabled: false,
      tokenUpdated: false
    },
  });
  
  // Create form for Telegram user preferences
  const telegramPrefsForm = useForm<z.infer<typeof telegramPreferencesSchema>>({
    resolver: zodResolver(telegramPreferencesSchema),
    defaultValues: {
      notificationsEnabled: true,
      receiveAlerts: true,
      receiveReports: true
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
  
  // Update Telegram settings (admin only)
  const updateTelegramSettingsMutation = useMutation({
    mutationFn: async (data: z.infer<typeof telegramBotSchema>) => {
      return await apiRequest('/api/telegram/settings', {
        method: 'PATCH',
        data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Telegram bot settings updated",
        description: "The Telegram integration has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/telegram/settings'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update Telegram settings",
        description: error.message || "There was an error updating the Telegram integration.",
        variant: "destructive",
      });
    },
  });
  
  // Update user's Telegram preferences
  const updateTelegramPrefsMutation = useMutation({
    mutationFn: async (data: z.infer<typeof telegramPreferencesSchema>) => {
      return await apiRequest('/api/telegram/preferences', {
        method: 'PATCH',
        data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Telegram preferences updated",
        description: "Your Telegram notification preferences have been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/telegram/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update preferences",
        description: error.message || "There was an error updating your Telegram preferences.",
        variant: "destructive",
      });
    },
  });
  
  // Disconnect from Telegram
  const disconnectTelegramMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/telegram/disconnect', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Disconnected from Telegram",
        description: "Your account has been disconnected from Telegram. You will no longer receive notifications.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/telegram/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to disconnect",
        description: error.message || "There was an error disconnecting from Telegram.",
        variant: "destructive",
      });
    },
  });
  
  // Generate verification code
  const generateCodeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/telegram/verify', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Verification code generated",
        description: "A verification code has been generated. Please send it to the Telegram bot to connect your account.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/telegram/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate code",
        description: error.message || "There was an error generating a verification code.",
        variant: "destructive",
      });
    },
  });
  
  // Send test message
  const sendTestMessageMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/telegram/test', {
        method: 'POST',
        data: {
          message: "This is a test message from the Emporium Power Monitoring system." 
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Test message sent",
        description: "A test message has been sent to your Telegram account.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "There was an error sending the test message.",
        variant: "destructive",
      });
    },
  });
  
  // Set form values for Telegram settings
  useEffect(() => {
    if (telegramSettings) {
      telegramBotForm.reset({
        botToken: "",  // Don't display actual token for security
        botUsername: telegramSettings.botUsername || "",
        isEnabled: telegramSettings.isEnabled,
        tokenUpdated: false,
      });
    }
  }, [telegramSettings, telegramBotForm]);

  // Set form values for Telegram preferences
  useEffect(() => {
    if (telegramStatus?.connected) {
      telegramPrefsForm.reset({
        notificationsEnabled: telegramStatus.notificationsEnabled,
        receiveAlerts: telegramStatus.receiveAlerts,
        receiveReports: telegramStatus.receiveReports,
      });
    }
  }, [telegramStatus, telegramPrefsForm]);
  
  // Handlers for Telegram forms
  const onUpdateTelegramSettings = (data: z.infer<typeof telegramBotSchema>) => {
    updateTelegramSettingsMutation.mutate(data);
  };
  
  const onUpdateTelegramPreferences = (data: z.infer<typeof telegramPreferencesSchema>) => {
    updateTelegramPrefsMutation.mutate(data);
  };
  
  const onDisconnectTelegram = () => {
    if (window.confirm("Are you sure you want to disconnect from Telegram? You will no longer receive notifications.")) {
      disconnectTelegramMutation.mutate();
    }
  };
  
  const onGenerateVerificationCode = () => {
    generateCodeMutation.mutate();
  };
  
  const onSendTestMessage = () => {
    sendTestMessageMutation.mutate();
  };
  
  return (
    <SharedLayout>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 w-full md:w-fit">
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
          <TabsTrigger value="integrations">
            <MessageSquare className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="developer">
            <BugPlay className="h-4 w-4 mr-2" />
            Advanced
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

        {/* Integrations Settings */}
        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>
                Configure external integrations and messaging services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Send className="h-5 w-5 text-blue-500" />
                    <h3 className="text-lg font-medium">Telegram Integration</h3>
                  </div>
                  {user?.role === 'Admin' && telegramSettings ? (
                    <Badge variant={telegramSettings.isEnabled ? "success" : "secondary"}>
                      {telegramSettings.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  ) : null}
                </div>

                {/* Setup Guide Accordion */}
                <Accordion type="single" collapsible className="w-full border-b">
                  <AccordionItem value="guide">
                    <AccordionTrigger className="px-4 py-3 text-sm font-medium">
                      How to Set Up Telegram Integration
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4 text-sm">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
                          <h4 className="font-medium text-blue-800 dark:text-blue-300 flex items-center">
                            <Info className="h-4 w-4 mr-2" />
                            Telegram Integration Setup Guide
                          </h4>
                          <p className="mt-2 text-blue-700 dark:text-blue-400">
                            Follow these steps to set up Telegram notifications for your Emporium Power Monitoring Dashboard.
                          </p>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <h5 className="font-medium mb-2">For Administrators:</h5>
                            <ol className="list-decimal list-inside space-y-2 ml-2">
                              <li className="pl-2">
                                <span className="font-medium">Create a Telegram Bot:</span>
                                <ul className="list-disc list-inside ml-6 mt-1 text-muted-foreground">
                                  <li>Open Telegram and search for <code>@BotFather</code></li>
                                  <li>Start a chat and send the command <code>/newbot</code></li>
                                  <li>Follow the instructions to create a new bot</li>
                                  <li>You'll receive a <strong>bot token</strong> - save this for the next step</li>
                                </ul>
                              </li>
                              <li className="pl-2 mt-4">
                                <span className="font-medium">Configure Bot in Dashboard:</span>
                                <ul className="list-disc list-inside ml-6 mt-1 text-muted-foreground">
                                  <li>Enter the <strong>Bot Token</strong> in the admin settings above</li>
                                  <li>Enter the <strong>Bot Username</strong> (ends with "bot")</li>
                                  <li>Enable the integration with the toggle switch</li>
                                  <li>Click "Save Bot Settings"</li>
                                </ul>
                              </li>
                              <li className="pl-2 mt-4">
                                <span className="font-medium">Test Your Configuration:</span>
                                <ul className="list-disc list-inside ml-6 mt-1 text-muted-foreground">
                                  <li>After setting up your bot, connect your own account</li>
                                  <li>Send a test message to verify everything is working</li>
                                </ul>
                              </li>
                            </ol>
                          </div>

                          <div>
                            <h5 className="font-medium mb-2">For All Users:</h5>
                            <ol className="list-decimal list-inside space-y-2 ml-2">
                              <li className="pl-2">
                                <span className="font-medium">Generate Verification Code:</span>
                                <ul className="list-disc list-inside ml-6 mt-1 text-muted-foreground">
                                  <li>Click the "Connect with Telegram" button</li>
                                  <li>A unique verification code will be generated</li>
                                </ul>
                              </li>
                              <li className="pl-2 mt-4">
                                <span className="font-medium">Connect Your Account:</span>
                                <ul className="list-disc list-inside ml-6 mt-1 text-muted-foreground">
                                  <li>Open Telegram and search for the bot by username</li>
                                  <li>Start a conversation with the bot</li>
                                  <li>Send your verification code as a message</li>
                                  <li>The bot will confirm your connection</li>
                                </ul>
                              </li>
                              <li className="pl-2 mt-4">
                                <span className="font-medium">Configure Notifications:</span>
                                <ul className="list-disc list-inside ml-6 mt-1 text-muted-foreground">
                                  <li>Once connected, customize your notification preferences</li>
                                  <li>Enable the types of alerts you want to receive</li>
                                  <li>Send a test message to verify everything works</li>
                                </ul>
                              </li>
                            </ol>
                          </div>

                          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
                            <h5 className="font-medium text-yellow-800 dark:text-yellow-300 flex items-center">
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Important Notes
                            </h5>
                            <ul className="list-disc list-inside mt-2 text-yellow-700 dark:text-yellow-400 space-y-1">
                              <li>The bot must be enabled by an administrator before users can connect</li>
                              <li>Verification codes expire after 10 minutes</li>
                              <li>You can disconnect your Telegram account at any time</li>
                              <li>For security, the system only sends messages to verified accounts</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                
                {(isLoadingTelegram || isLoadingTelegramStatus) ? (
                  <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="p-4 space-y-6">
                    {/* Admin-only settings */}
                    {user?.role === 'Admin' && (
                      <div className="space-y-4">
                        <h4 className="font-medium text-lg">Bot Configuration</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          Configure the Telegram bot that users will interact with
                        </p>
                        
                        <Form {...telegramBotForm}>
                          <form onSubmit={telegramBotForm.handleSubmit(onUpdateTelegramSettings)} className="space-y-4">
                            <FormField
                              control={telegramBotForm.control}
                              name="botToken"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Bot Token</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="password" 
                                      placeholder={telegramSettings?.hasToken ? "••••••••" : "Enter bot token"} 
                                      {...field}
                                      onChange={(e) => {
                                        field.onChange(e.target.value);
                                        telegramBotForm.setValue('tokenUpdated', true);
                                      }}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Token provided by @BotFather when creating a Telegram bot
                                  </FormDescription>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={telegramBotForm.control}
                              name="botUsername"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Bot Username</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="username_bot" 
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    The username of your Telegram bot (usually ends with '_bot')
                                  </FormDescription>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={telegramBotForm.control}
                              name="isEnabled"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base">Enable Telegram Integration</FormLabel>
                                    <FormDescription>
                                      Allow users to connect and receive notifications via Telegram
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
                            
                            <Button 
                              type="submit" 
                              disabled={!telegramBotForm.formState.isDirty || updateTelegramSettingsMutation.isPending}
                            >
                              {updateTelegramSettingsMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Save Bot Settings
                            </Button>
                          </form>
                        </Form>
                      </div>
                    )}
                    
                    {/* User connection settings - visible to all users */}
                    <Separator className="my-6" />
                    
                    <div className="space-y-4">
                      <h4 className="font-medium text-lg">Your Telegram Connection</h4>
                      
                      {telegramStatus?.connected ? (
                        <>
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-lg p-4 flex items-start space-x-3">
                            <Check className="h-5 w-5 text-green-500 mt-0.5" />
                            <div>
                              <h5 className="font-medium text-green-800 dark:text-green-300">Connected to Telegram</h5>
                              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                                Your account is connected to Telegram {telegramStatus.telegramUsername ? 
                                  `(@${telegramStatus.telegramUsername})` : ''}
                              </p>
                              {telegramStatus.lastAccessed && (
                                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                                  Last activity: {new Date(telegramStatus.lastAccessed).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <Form {...telegramPrefsForm}>
                            <form onSubmit={telegramPrefsForm.handleSubmit(onUpdateTelegramPreferences)} className="space-y-4">
                              <FormField
                                control={telegramPrefsForm.control}
                                name="notificationsEnabled"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center justify-between p-3 border rounded-lg">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">Telegram Notifications</FormLabel>
                                      <FormDescription>
                                        Receive notifications through Telegram
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
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FormField
                                  control={telegramPrefsForm.control}
                                  name="receiveAlerts"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between p-3 border rounded-lg">
                                      <div className="space-y-0.5">
                                        <FormLabel className="text-base">Alert Notifications</FormLabel>
                                        <FormDescription>
                                          Receive system alerts and warnings
                                        </FormDescription>
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          disabled={!telegramPrefsForm.watch('notificationsEnabled')}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                
                                <FormField
                                  control={telegramPrefsForm.control}
                                  name="receiveReports"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between p-3 border rounded-lg">
                                      <div className="space-y-0.5">
                                        <FormLabel className="text-base">Report Delivery</FormLabel>
                                        <FormDescription>
                                          Receive scheduled reports and summaries
                                        </FormDescription>
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          disabled={!telegramPrefsForm.watch('notificationsEnabled')}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <Button 
                                  type="submit" 
                                  disabled={!telegramPrefsForm.formState.isDirty || updateTelegramPrefsMutation.isPending}
                                >
                                  {updateTelegramPrefsMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Save Preferences
                                </Button>
                                
                                <Button 
                                  type="button"
                                  variant="destructive"
                                  onClick={onDisconnectTelegram}
                                  disabled={disconnectTelegramMutation.isPending}
                                >
                                  {disconnectTelegramMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Disconnect Telegram
                                </Button>
                              </div>
                              
                              <div className="mt-4">
                                <Button 
                                  type="button"
                                  variant="outline"
                                  className="w-full"
                                  onClick={onSendTestMessage}
                                  disabled={sendTestMessageMutation.isPending || !telegramPrefsForm.watch('notificationsEnabled')}
                                >
                                  {sendTestMessageMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Send Test Message
                                </Button>
                              </div>
                            </form>
                          </Form>
                        </>
                      ) : (
                        <div className="space-y-4">
                          {telegramStatus?.verificationCode ? (
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                              <h5 className="font-medium text-blue-800 dark:text-blue-300">Verification Pending</h5>
                              <p className="text-sm text-blue-700 dark:text-blue-400 mt-2">
                                Send the following verification code to our Telegram bot to connect your account:
                              </p>
                              <div className="mt-3 flex items-center justify-center">
                                <code className="bg-white dark:bg-blue-950 p-3 rounded-md font-mono text-lg font-bold text-blue-600 dark:text-blue-300 tracking-wider">
                                  /verify {telegramStatus.verificationCode}
                                </code>
                              </div>
                              <p className="text-xs text-blue-600 dark:text-blue-500 mt-2">
                                This code will expire on {telegramStatus.verificationExpires ? 
                                  new Date(telegramStatus.verificationExpires).toLocaleString() : 'soon'}
                              </p>
                            </div>
                          ) : (
                            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center">
                              <div className="flex justify-center mb-4">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                  <MessageCircle className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                                </div>
                              </div>
                              <h5 className="font-medium text-lg">Connect to Telegram</h5>
                              <p className="text-slate-600 dark:text-slate-400 mt-2 mb-6 max-w-md mx-auto">
                                Connect your account to Telegram to receive notifications, alerts, and reports directly to your device.
                              </p>
                              <Button
                                onClick={onGenerateVerificationCode}
                                disabled={generateCodeMutation.isPending}
                              >
                                {generateCodeMutation.isPending && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Connect to Telegram
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Advanced Developer Settings */}
        <TabsContent value="developer">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Developer Settings</CardTitle>
              <CardDescription>
                Tools and utilities for testing and development
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Notification System</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Test the notification system by creating sample notifications
                </p>
                <div className="flex items-center space-x-4">
                  <CreateTestNotificationButton />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </SharedLayout>
  );
}