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
import { Loader2, Save, Send, Settings, Users, Zap, CloudSun, Palette, Globe, BugPlay, MessageSquare, MessageCircle, Check, AlertTriangle, Info, PlayCircle, RefreshCw } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreateTestNotificationButton } from "@/components/create-test-notification-button";
import { AgentModal } from "@/components/langchain/AgentModal";
import { ToolModal } from "@/components/langchain/ToolModal";
import { PromptModal } from "@/components/langchain/PromptModal";
import { ViewSchemaButton, ConfigureButton } from "@/components/langchain/ToolButtons";
import { AgentTester } from "@/components/langchain/AgentTester";
import { DynamicToolRegistration } from "@/components/langchain/DynamicToolRegistration";

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
  const [activeLangchainTab, setActiveLangchainTab] = useState("agents");
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [selectedAgentForTesting, setSelectedAgentForTesting] = useState<any>(null);
  const [activeAgentModalTab, setActiveAgentModalTab] = useState<string>("settings");
  
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
  
  // Fetch LangChain agents
  const { data: langchainAgents = [], isLoading: isLoadingAgents } = useQuery({
    queryKey: ['/api/langchain/agents'],
    queryFn: getQueryFn({ on401: 'throw' }),
    // Always fetch agents so they're available when switching tabs
    // enabled: activeTab === "langchain"
  }) as { data: any[], isLoading: boolean };
  
  // Add debugging for active tab and agent data
  useEffect(() => {
    console.log("Current active tab:", activeTab);
    console.log("LangChain agents data:", langchainAgents);
  }, [activeTab, langchainAgents]);
  
  // Fetch LangChain tools
  const { data: langchainTools = [], isLoading: isLoadingTools } = useQuery({
    queryKey: ['/api/langchain/tools'],
    queryFn: getQueryFn({ on401: 'throw' }),
    enabled: activeTab === "langchain"
  }) as { data: any[], isLoading: boolean };
  
  // Fetch LangChain prompt templates
  const { data: langchainPrompts = [], isLoading: isLoadingPrompts } = useQuery({
    queryKey: ['/api/langchain/prompts'],
    queryFn: getQueryFn({ on401: 'throw' }),
    enabled: activeTab === "langchain"
  }) as { data: any[], isLoading: boolean };
  
  // Fetch LangChain execution runs
  const { data: langchainRuns = [], isLoading: isLoadingRuns } = useQuery({
    queryKey: ['/api/langchain/runs'],
    queryFn: getQueryFn({ on401: 'throw' }),
    enabled: activeTab === "langchain" && activeLangchainTab === "runs"
  }) as { data: any[], isLoading: boolean };
  
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
    if (window.confirm("Are you sure you want to disconnect from Telegram? This will allow you to test the verification process again.")) {
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
          <TabsTrigger value="langchain">
            <Zap className="h-4 w-4 mr-2" />
            LangChain
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
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-lg">Bot Configuration</h4>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex items-center gap-1 bg-amber-900/30 border-amber-800 text-amber-300 hover:bg-amber-800"
                            onClick={() => {
                              if (window.confirm("Are you sure you want to restart the Telegram bot? This will disconnect any active sessions but can fix connection issues.")) {
                                // Send the restart request
                                apiRequest('/api/telegram/restart-bot', {
                                  method: 'POST'
                                })
                                .then(response => {
                                  toast({
                                    title: "Telegram Bot Restarted",
                                    description: "The Telegram bot has been restarted successfully. This should fix any connection issues.",
                                    variant: "default"
                                  });
                                  // Refresh the settings data
                                  queryClient.invalidateQueries({ queryKey: ['/api/telegram/settings'] });
                                  queryClient.invalidateQueries({ queryKey: ['/api/telegram/status'] });
                                })
                                .catch(error => {
                                  toast({
                                    title: "Failed to Restart Bot",
                                    description: error.message || "There was an error restarting the Telegram bot.",
                                    variant: "destructive"
                                  });
                                });
                              }
                            }}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Restart Bot
                          </Button>
                        </div>
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
                                  size="lg"
                                  className="w-full text-lg"
                                >
                                  {disconnectTelegramMutation.isPending ? (
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                  ) : (
                                    <span className="mr-2">🔌</span>
                                  )}
                                  Disconnect Telegram to Re-Test Verification
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
        
        {/* LangChain Agent and Tools Configuration */}
        <TabsContent value="langchain">
          <Card>
            <CardHeader>
              <CardTitle>LangChain Agent Configuration</CardTitle>
              <CardDescription>
                Configure LangChain agents, tools, and prompt templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs 
                value={activeLangchainTab} 
                onValueChange={setActiveLangchainTab} 
                className="mt-2"
              >
                <TabsList className="grid grid-cols-4 mb-6">
                  <TabsTrigger value="agents">Agents</TabsTrigger>
                  <TabsTrigger value="tools">Tools</TabsTrigger>
                  <TabsTrigger value="prompts">Prompt Templates</TabsTrigger>
                  <TabsTrigger value="runs">Execution Runs</TabsTrigger>
                </TabsList>
                
                {/* Agents Tab */}
                <TabsContent value="agents">
                  <div className="space-y-6">
                    {/* Agent Tester Card */}
                    <AgentTester 
                      selectedAgent={selectedAgentForTesting} 
                      onClearAgent={() => setSelectedAgentForTesting(null)} 
                    />
                  
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Agent Models</h3>
                      <Button 
                        variant="outline" 
                        className="flex items-center gap-2"
                        onClick={() => {
                          setIsAgentModalOpen(true);
                        }}
                      >
                        <Zap className="h-4 w-4" />
                        Create New Agent
                      </Button>
                    </div>
                    
                    {/* Agent List */}
                    <div className="grid gap-5">
                      {/* Default agent card */}
                      <Card className="overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-blue-950 to-indigo-950 pb-3">
                          <div className="flex justify-between items-center">
                            <CardTitle className="flex items-center gap-2 text-white">
                              <Zap className="h-5 w-5 text-blue-400" />
                              Main Assistant Agent
                            </CardTitle>
                            <Badge variant="outline" className="bg-blue-950 text-blue-300 border-blue-700">Default</Badge>
                          </div>
                          <CardDescription className="text-slate-300">
                            Primary agent for user interactions using GPT-4o and custom tools
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-5 bg-gradient-to-b from-slate-950 to-slate-900">
                          <div className="space-y-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div className="rounded-md border p-3 bg-slate-900">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium text-sm text-slate-400">Model</div>
                                  <div className="text-sm font-mono text-white bg-blue-950 px-2 py-0.5 rounded-full">
                                    {langchainAgents?.find(a => a.name === "Main Assistant Agent")?.modelName || "gpt-4o"}
                                  </div>
                                </div>
                              </div>
                              <div className="rounded-md border p-3 bg-slate-900">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium text-sm text-slate-400">Temperature</div>
                                  <div className="text-sm font-mono text-white">
                                    {langchainAgents?.find(a => a.name === "Main Assistant Agent")?.temperature?.toFixed(1) || "0.7"}
                                  </div>
                                </div>
                              </div>
                              <div className="rounded-md border p-3 bg-slate-900">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium text-sm text-slate-400">Tools</div>
                                  <div className="text-sm font-mono text-white">
                                    {langchainAgents?.find(a => a.name === "Main Assistant Agent")?.tools?.length || 0} active
                                  </div>
                                </div>
                              </div>
                              <div className="rounded-md border p-3 bg-slate-900">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium text-sm text-slate-400">Status</div>
                                  <Badge variant="outline" className="bg-green-950 text-green-400 border-green-800">
                                    {langchainAgents?.find(a => a.name === "Main Assistant Agent")?.enabled ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            
                            {/* System Prompt Section */}
                            <div className="rounded-md border p-3 bg-slate-900 mt-4">
                              <div className="text-xs font-medium text-slate-400 mb-2">System Prompt</div>
                              <div className="text-sm max-h-24 overflow-y-auto pr-2 text-slate-300">
                                {langchainAgents?.find(a => a.name === "Main Assistant Agent")?.systemPrompt || 
                                  "You are an AI assistant that helps users with power monitoring and energy-related queries. You have access to real-time data and can generate reports and analyze trends."}
                              </div>
                            </div>
                            
                            {/* Tools Section */}
                            <div className="mt-4">
                              <div className="text-xs font-medium text-slate-400 mb-2">Assigned Tools</div>
                              <div className="flex flex-wrap gap-2">
                                {langchainAgents?.find(a => a.name === "Main Assistant Agent")?.tools?.length > 0 ? (
                                  langchainAgents?.find(a => a.name === "Main Assistant Agent")?.tools?.map((tool, index) => (
                                    <Badge 
                                      key={tool.id || index} 
                                      variant="secondary"
                                      className="bg-blue-950/30 text-blue-300 border-blue-900"
                                    >
                                      {tool.name}
                                    </Badge>
                                  ))
                                ) : (
                                  <div className="text-sm text-slate-500 italic">No tools assigned</div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex justify-end gap-2 mt-4">
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="text-indigo-600 bg-indigo-100 hover:bg-indigo-200"
                                onClick={() => {
                                  // Use the actual agent data from langchainAgents
                                  if (langchainAgents && langchainAgents.length > 0) {
                                    // Find the agent with name "Main Assistant Agent"
                                    const mainAgent = langchainAgents.find(agent => agent.name === "Main Assistant Agent") || langchainAgents[0];
                                    setSelectedAgentForTesting(mainAgent);
                                    toast({
                                      title: "Test Mode Activated",
                                      description: `Agent "${mainAgent.name}" is ready for testing.`,
                                      variant: "default"
                                    });
                                  } else {
                                    toast({
                                      title: "Agent data not available",
                                      description: "Could not load agent details. Please try again.",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                              >
                                <PlayCircle className="h-4 w-4 mr-1" />
                                Test Agent
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-slate-400"
                                onClick={() => {
                                  // Use the actual agent data from langchainAgents
                                  if (langchainAgents && langchainAgents.length > 0) {
                                    // Find the agent with name "Main Assistant Agent"
                                    const mainAgent = langchainAgents.find(agent => agent.name === "Main Assistant Agent") || langchainAgents[0];
                                    setSelectedAgent(mainAgent);
                                    // Open agent modal in read-only mode
                                    setIsAgentModalOpen(true);
                                  } else {
                                    toast({
                                      title: "Agent data not available",
                                      description: "Could not load agent details. Please try again.",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                              >
                                View Details
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-blue-400"
                                onClick={() => {
                                  // Use the actual agent data from langchainAgents
                                  if (langchainAgents && langchainAgents.length > 0) {
                                    // Find the agent with name "Main Assistant Agent"
                                    const mainAgent = langchainAgents.find(agent => agent.name === "Main Assistant Agent") || langchainAgents[0];
                                    setSelectedAgent(mainAgent);
                                    // Open agent modal for editing
                                    setIsAgentModalOpen(true);
                                  } else {
                                    toast({
                                      title: "Agent data not available",
                                      description: "Could not load agent details for editing. Please try again.",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                              >
                                Edit
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Dynamic agent cards - render additional agents from the database */}
                      {console.log("Agents before filtering:", langchainAgents?.map(a => a.name) || [])}
                      {Array.isArray(langchainAgents) && langchainAgents.length > 0 && langchainAgents.filter(agent => {
                        // Skip the main agent since it's already rendered above
                        const shouldInclude = agent && agent.name && agent.name !== "Main Assistant Agent";
                        if (agent && agent.name) {
                          console.log(`Agent ${agent.name} included: ${shouldInclude}`);
                        }
                        return shouldInclude;
                      }).map((agent) => (
                        <Card key={agent.id} className="overflow-hidden">
                          <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 pb-3">
                            <div className="flex justify-between items-center">
                              <CardTitle className="flex items-center gap-2 text-white">
                                <Zap className="h-5 w-5 text-indigo-400" />
                                {agent.name}
                              </CardTitle>
                              {agent.enabled ? (
                                <Badge variant="outline" className="bg-green-950 text-green-300 border-green-800">Active</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-slate-950 text-slate-300 border-slate-800">Inactive</Badge>
                              )}
                            </div>
                            <CardDescription className="text-slate-300">
                              {agent.description || "Custom LangChain agent with specialized capabilities"}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-5 bg-gradient-to-b from-slate-950 to-slate-900">
                            <div className="space-y-4">
                              <div className="grid sm:grid-cols-2 gap-4">
                                <div className="rounded-md border p-3 bg-slate-900">
                                  <div className="text-xs font-medium text-muted-foreground mb-2">Model</div>
                                  <div className="text-sm">{agent.modelName || "GPT-4o"}</div>
                                </div>
                                <div className="rounded-md border p-3 bg-slate-900">
                                  <div className="text-xs font-medium text-muted-foreground mb-2">Tools</div>
                                  <div className="text-sm">{agent.tools && agent.tools.length > 0 ? `${agent.tools.length} active` : "0 configured"}</div>
                                </div>
                              </div>
                              
                              {/* System Prompt Section */}
                              <div className="rounded-md border p-3 bg-slate-900">
                                <div className="text-xs font-medium text-muted-foreground mb-2">System Prompt</div>
                                <div className="text-sm max-h-24 overflow-y-auto pr-2 text-slate-300">
                                  {agent.systemPrompt || "No system prompt defined."}
                                </div>
                              </div>
                              
                              {/* Tools Section - display assigned tools */}
                              {agent.tools && agent.tools.length > 0 ? (
                                <div className="rounded-md border p-3 bg-slate-900">
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="text-xs font-medium text-muted-foreground">
                                      Assigned Tools
                                    </div>
                                    <Badge 
                                      variant="secondary"
                                      className="bg-indigo-900/30 text-indigo-300 border-indigo-800"
                                    >
                                      {agent.tools.length} tools
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {agent.tools.map((tool: any) => (
                                      <div key={tool.id || tool.name} 
                                        className="bg-slate-800 rounded-full px-3 py-1 flex items-center text-sm"
                                      >
                                        <div className="flex-shrink-0 h-4 w-4 flex items-center justify-center bg-indigo-900 rounded-full mr-2">
                                          <span className="text-xs font-semibold text-indigo-300">{tool.priority || 0}</span>
                                        </div>
                                        <span className="mr-1">{tool.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-md border p-3 bg-slate-900">
                                  <div className="text-xs font-medium text-muted-foreground mb-2">
                                    Assigned Tools
                                  </div>
                                  <div className="text-sm text-slate-400 italic">
                                    No tools assigned to this agent
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex justify-end gap-2 mt-4">
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  className="text-indigo-600 bg-indigo-100 hover:bg-indigo-200"
                                  onClick={() => {
                                    setSelectedAgentForTesting(agent);
                                    toast({
                                      title: "Test Mode Activated",
                                      description: `Agent "${agent.name}" is ready for testing.`,
                                      variant: "default"
                                    });
                                  }}
                                >
                                  <PlayCircle className="h-4 w-4 mr-1" />
                                  Test Agent
                                </Button>
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  className="text-emerald-600 bg-emerald-100 hover:bg-emerald-200"
                                  onClick={() => {
                                    setSelectedAgent(agent);
                                    setIsAgentModalOpen(true);
                                    // Set the active tab to "tools" by directly passing the parameter to the AgentModal
                                    // This will be handled by the AgentModal to initially show the tools tab
                                    setActiveAgentModalTab("tools");
                                  }}
                                >
                                  <Settings className="h-4 w-4 mr-1" />
                                  Configure Tools
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-slate-400"
                                  onClick={() => {
                                    setSelectedAgent(agent);
                                    setIsAgentModalOpen(true);
                                    // Set the active tab to "settings"
                                    setActiveAgentModalTab("settings");
                                  }}
                                >
                                  Edit
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>
                
                {/* Tools Tab */}
                <TabsContent value="tools">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Available Tools</h3>
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary"
                          size="sm"
                          className="flex items-center gap-2 bg-amber-100 text-amber-800 hover:bg-amber-200"
                          onClick={async () => {
                            try {
                              const response = await apiRequest('/api/langchain/update-tools', {
                                method: 'POST',
                              });
                              
                              toast({
                                title: "Tool schemas updated",
                                description: "Tool schemas have been updated to the latest format.",
                                variant: "default"
                              });
                              
                              // Invalidate queries to refresh data
                              queryClient.invalidateQueries({ queryKey: ['/api/langchain/tools'] });
                              queryClient.invalidateQueries({ queryKey: ['/api/langchain/status'] });
                              queryClient.invalidateQueries({ queryKey: ['/api/langchain/health'] });
                            } catch (error) {
                              toast({
                                title: "Failed to update tools",
                                description: error.message || "There was an error updating tool schemas.",
                                variant: "destructive"
                              });
                            }
                          }}
                        >
                          <RefreshCw className="h-4 w-4" />
                          Update Tool Schemas
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex items-center gap-2"
                          onClick={() => {
                            setSelectedTool(null); // Reset any selected tool
                            setIsToolModalOpen(true); // Open the create tool modal
                          }}
                        >
                          <Zap className="h-4 w-4" />
                          Create New Tool
                        </Button>
                      </div>
                    </div>
                    
                    {/* Dynamic Tool Registration */}
                    <DynamicToolRegistration 
                      onToolRegistered={(tool) => {
                        toast({
                          title: "Tool registered successfully",
                          description: `The tool "${tool.name}" has been registered and is now available.`,
                          variant: "default"
                        });
                        
                        // Refresh data
                        queryClient.invalidateQueries({ queryKey: ['/api/langchain/tools'] });
                      }}
                    />
                    
                    {/* Tools List */}
                    <div className="grid gap-5">
                      {/* ReadFromDB Tool */}
                      <Card className="overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-indigo-950 to-purple-950 pb-3">
                          <div className="flex justify-between items-center">
                            <CardTitle className="flex items-center gap-2 text-white">
                              <div className="bg-indigo-900 w-8 h-8 flex items-center justify-center rounded-md text-indigo-300">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                  <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                                </svg>
                              </div>
                              ReadFromDB
                            </CardTitle>
                            <Badge variant="outline" className="bg-indigo-950 text-indigo-300 border-indigo-700">Built-in</Badge>
                          </div>
                          <CardDescription className="text-slate-300">
                            Parameterized database queries with SQL injection protection
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-5 bg-gradient-to-b from-slate-950 to-slate-900">
                          <div className="space-y-4">
                            <div className="grid gap-4">
                              <div className="rounded-md border p-3 bg-slate-900">
                                <div className="font-medium text-sm text-slate-400 mb-1">Tool Type</div>
                                <div className="text-sm font-mono text-white">Custom Tool (Database)</div>
                              </div>
                              <div className="rounded-md border p-3 bg-slate-900">
                                <div className="font-medium text-sm text-slate-400 mb-1">Access</div>
                                <div className="text-sm text-white">23 tables available</div>
                              </div>
                            </div>
                            
                            <div className="flex justify-end gap-2 mt-4">
                              <ViewSchemaButton 
                                toolName="ReadFromDB" 
                                setSelectedTool={setSelectedTool} 
                                setIsToolModalOpen={setIsToolModalOpen} 
                              />
                              <ConfigureButton 
                                toolName="ReadFromDB" 
                                setSelectedTool={setSelectedTool} 
                                setIsToolModalOpen={setIsToolModalOpen} 
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      {/* CompileReport Tool */}
                      <Card className="overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-emerald-950 to-teal-950 pb-3">
                          <div className="flex justify-between items-center">
                            <CardTitle className="flex items-center gap-2 text-white">
                              <div className="bg-emerald-900 w-8 h-8 flex items-center justify-center rounded-md text-emerald-300">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                  <path d="M14 2v6h6"></path>
                                  <path d="M16 13H8"></path>
                                  <path d="M16 17H8"></path>
                                  <path d="M10 9H8"></path>
                                </svg>
                              </div>
                              CompileReport
                            </CardTitle>
                            <Badge variant="outline" className="bg-emerald-950 text-emerald-300 border-emerald-700">Built-in</Badge>
                          </div>
                          <CardDescription className="text-slate-300">
                            Generate Markdown and PDF reports from structured data
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-5 bg-gradient-to-b from-slate-950 to-slate-900">
                          <div className="space-y-4">
                            <div className="grid gap-4">
                              <div className="rounded-md border p-3 bg-slate-900">
                                <div className="font-medium text-sm text-slate-400 mb-1">Tool Type</div>
                                <div className="text-sm font-mono text-white">Custom Tool (Reports)</div>
                              </div>
                              <div className="rounded-md border p-3 bg-slate-900">
                                <div className="font-medium text-sm text-slate-400 mb-1">Output Formats</div>
                                <div className="text-sm text-white">Markdown, PDF</div>
                              </div>
                            </div>
                            
                            <div className="flex justify-end gap-2 mt-4">
                              <ViewSchemaButton 
                                toolName="CompileReport" 
                                setSelectedTool={setSelectedTool} 
                                setIsToolModalOpen={setIsToolModalOpen} 
                              />
                              <ConfigureButton 
                                toolName="CompileReport" 
                                setSelectedTool={setSelectedTool} 
                                setIsToolModalOpen={setIsToolModalOpen} 
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Prompt Templates Tab */}
                <TabsContent value="prompts">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Prompt Templates</h3>
                      <Button 
                        variant="outline" 
                        className="flex items-center gap-2"
                        onClick={() => {
                          setIsPromptModalOpen(true);
                          toast({
                            title: "Create Prompt Template",
                            description: "This would open a form to create a new prompt template"
                          });
                        }}
                      >
                        <Zap className="h-4 w-4" />
                        Create Template
                      </Button>
                    </div>
                    
                    <div className="rounded-md border p-6 bg-slate-950">
                      <div className="text-center py-8 space-y-3">
                        <div className="mx-auto h-12 w-12 rounded-full bg-slate-900 flex items-center justify-center mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-slate-300">No Prompt Templates</h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">
                          Create prompt templates to standardize AI interactions and ensure consistent responses
                        </p>
                        <Button 
                          variant="outline" 
                          className="mt-2"
                          onClick={() => {
                            setIsPromptModalOpen(true);
                            toast({
                              title: "Create Prompt Template",
                              description: "This would open a form to create a new prompt template"
                            });
                          }}
                        >
                          Create Your First Template
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Runs Tab */}
                <TabsContent value="runs">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Execution Runs</h3>
                    </div>
                    
                    <div className="rounded-md border overflow-hidden">
                      <div className="p-4 bg-slate-900 border-b border-slate-700">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium">Recent Runs</h4>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8"
                              onClick={() => {
                                queryClient.invalidateQueries({ queryKey: ['/api/langchain/runs'] });
                                toast({
                                  title: "Refreshing execution runs",
                                  description: "Getting the latest execution data from the database",
                                  variant: "default"
                                });
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                              </svg>
                              Refresh
                            </Button>
                            <Select defaultValue="all">
                              <SelectTrigger className="w-[160px] h-8">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="running">Running</SelectItem>
                                <SelectItem value="error">Error</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-0">
                        <div className="relative overflow-x-auto">
                          <table className="w-full text-sm text-left text-slate-300">
                            <thead className="text-xs uppercase bg-slate-900 text-slate-400">
                              <tr>
                                <th scope="col" className="px-4 py-3">ID</th>
                                <th scope="col" className="px-4 py-3">Agent</th>
                                <th scope="col" className="px-4 py-3">Started</th>
                                <th scope="col" className="px-4 py-3">Duration</th>
                                <th scope="col" className="px-4 py-3">Status</th>
                                <th scope="col" className="px-4 py-3">Tools Used</th>
                                <th scope="col" className="px-4 py-3">Tokens</th>
                                <th scope="col" className="px-4 py-3"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {isLoadingRuns ? (
                                <tr className="border-b border-slate-800">
                                  <td colSpan={8} className="px-4 py-4 text-center">
                                    <div className="flex justify-center">
                                      <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                    </div>
                                  </td>
                                </tr>
                              ) : langchainRuns && langchainRuns.length > 0 ? (
                                langchainRuns.map((run) => (
                                  <tr key={run.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                    <td className="px-4 py-3 font-mono text-xs">{run.id}</td>
                                    <td className="px-4 py-3">{run.agentName || 'Unknown'}</td>
                                    <td className="px-4 py-3">
                                      {run.startTime ? new Date(run.startTime).toLocaleString() : 'Unknown'}
                                    </td>
                                    <td className="px-4 py-3">
                                      {run.endTime && run.startTime 
                                        ? `${Math.round((new Date(run.endTime).getTime() - new Date(run.startTime).getTime()) / 1000)}s` 
                                        : 'In progress'}
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge 
                                        variant={
                                          run.status === 'completed' ? 'default' :
                                          run.status === 'running' ? 'secondary' :
                                          run.status === 'error' ? 'destructive' : 'outline'
                                        }
                                      >
                                        {run.status || 'Unknown'}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3">{run.toolCount || 0}</td>
                                    <td className="px-4 py-3">{run.totalTokens || 0}</td>
                                    <td className="px-4 py-3 text-right">
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                      </Button>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr className="border-b border-slate-800">
                                  <td colSpan={8} className="px-4 py-10 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                      <div className="h-10 w-10 rounded-full bg-slate-900 flex items-center justify-center mb-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-500">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                                        </svg>
                                      </div>
                                      <p className="text-slate-500">No execution runs found</p>
                                      <p className="text-xs text-slate-600">Runs will be tracked when you interact with the AI agent</p>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
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
      
      {/* LangChain Modals */}
      <AgentModal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        agent={selectedAgent}
        activeTab={activeAgentModalTab}
      />
      
      <ToolModal
        isOpen={isToolModalOpen}
        onClose={() => setIsToolModalOpen(false)}
        tool={selectedTool}
      />
      
      <PromptModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        promptTemplate={null}
      />
    </SharedLayout>
  );
}