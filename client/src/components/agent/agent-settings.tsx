import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  RefreshCw,
  Save,
  Settings,
  Check,
  Bot,
  MessageSquare,
  Bell,
  Brain,
  VolumeX,
  Sliders,
  Key
} from 'lucide-react';

interface AgentSetting {
  id: number;
  name: string;
  value: string;
  category: string;
  displayName: string;
  description: string;
  type: string;
  options?: string[];
  createdAt: string;
  updatedAt: string;
  updatedBy: number | null;
}

export function AgentSettings() {
  const [modifiedSettings, setModifiedSettings] = useState<Record<string, string>>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>('behavior');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/agent/settings'],
    select: (data) => data as AgentSetting[]
  });
  
  // Update setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: async ({ name, value }: { name: string, value: string }) => {
      return await apiRequest(`/api/agent/settings/${name}`, {
        method: 'PATCH',
        body: JSON.stringify({ value })
      });
    },
    onSuccess: (data, variables) => {
      // Remove from modified settings
      setModifiedSettings(prev => {
        const updated = { ...prev };
        delete updated[variables.name];
        return updated;
      });
      
      // Show success toast
      toast({
        title: 'Setting updated',
        description: 'The setting has been updated successfully.',
        variant: 'default',
      });
      
      // Invalidate settings
      queryClient.invalidateQueries({ queryKey: ['/api/agent/settings'] });
    },
    onError: (error) => {
      toast({
        title: 'Error updating setting',
        description: 'Failed to update the setting. Please try again.',
        variant: 'destructive',
      });
    }
  });
  
  // Group settings by category
  const getSettingsByCategory = () => {
    if (!settings) return {};
    
    const categories: Record<string, AgentSetting[]> = {};
    
    settings.forEach(setting => {
      if (!categories[setting.category]) {
        categories[setting.category] = [];
      }
      categories[setting.category].push(setting);
    });
    
    return categories;
  };
  
  // Handle setting change
  const handleSettingChange = (name: string, value: string) => {
    setModifiedSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle saving setting changes
  const handleSaveSetting = (name: string) => {
    if (modifiedSettings[name] !== undefined) {
      updateSettingMutation.mutate({
        name,
        value: modifiedSettings[name]
      });
    }
  };
  
  // Handle save all changes
  const handleSaveAllChanges = () => {
    Object.entries(modifiedSettings).forEach(([name, value]) => {
      updateSettingMutation.mutate({ name, value });
    });
  };
  
  // Get icon for category
  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'behavior':
        return <Brain className="h-4 w-4" />;
      case 'messaging':
        return <MessageSquare className="h-4 w-4" />;
      case 'notifications':
        return <Bell className="h-4 w-4" />;
      case 'api':
        return <Key className="h-4 w-4" />;
      case 'model':
        return <Bot className="h-4 w-4" />;
      case 'privacy':
        return <VolumeX className="h-4 w-4" />;
      default:
        return <Sliders className="h-4 w-4" />;
    }
  };
  
  // Render form field based on setting type
  const renderSettingField = (setting: AgentSetting) => {
    const currentValue = modifiedSettings[setting.name] !== undefined
      ? modifiedSettings[setting.name]
      : setting.value;
      
    switch (setting.type) {
      case 'text':
        return (
          <Input
            id={setting.name}
            value={currentValue}
            onChange={(e) => handleSettingChange(setting.name, e.target.value)}
          />
        );
        
      case 'textarea':
        return (
          <Textarea
            id={setting.name}
            value={currentValue}
            onChange={(e) => handleSettingChange(setting.name, e.target.value)}
            rows={5}
          />
        );
        
      case 'select':
        return (
          <Select
            value={currentValue}
            onValueChange={(value) => handleSettingChange(setting.name, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {setting.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
        
      case 'boolean':
        return (
          <Switch
            id={setting.name}
            checked={currentValue === 'true'}
            onCheckedChange={(checked) => handleSettingChange(setting.name, checked ? 'true' : 'false')}
          />
        );
        
      case 'number':
        return (
          <Input
            id={setting.name}
            type="number"
            value={currentValue}
            onChange={(e) => handleSettingChange(setting.name, e.target.value)}
          />
        );
        
      case 'slider':
        const min = Math.min(...(setting.options?.map(Number) || [0, 1]));
        const max = Math.max(...(setting.options?.map(Number) || [0, 1]));
        const step = (max - min) / 10;
        
        return (
          <div className="space-y-2">
            <Slider
              defaultValue={[Number(currentValue)]}
              min={min}
              max={max}
              step={step}
              onValueChange={(values) => handleSettingChange(setting.name, values[0].toString())}
            />
            <div className="text-right text-sm">{currentValue}</div>
          </div>
        );
        
      default:
        return (
          <Input
            id={setting.name}
            value={currentValue}
            onChange={(e) => handleSettingChange(setting.name, e.target.value)}
          />
        );
    }
  };
  
  return (
    <Card className="w-full shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Agent Settings
          </CardTitle>
          {Object.keys(modifiedSettings).length > 0 && (
            <Button
              size="sm"
              className="flex items-center gap-1"
              onClick={handleSaveAllChanges}
              disabled={updateSettingMutation.isPending}
            >
              {updateSettingMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save All Changes
            </Button>
          )}
        </div>
        <CardDescription>
          Configure behavior and settings for the AI agent
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !settings || settings.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-32 text-center">
            <Settings className="h-10 w-10 mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No settings found</p>
          </div>
        ) : (
          <Accordion
            type="single"
            collapsible
            defaultValue="behavior"
            className="w-full"
            value={expandedCategory || undefined}
            onValueChange={(value) => setExpandedCategory(value)}
          >
            {Object.entries(getSettingsByCategory()).map(([category, categorySettings]) => (
              <AccordionItem value={category} key={category}>
                <AccordionTrigger className="flex items-center">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(category)}
                    <span className="capitalize">{category}</span>
                    {Object.keys(modifiedSettings).some(name => 
                      categorySettings.some(setting => setting.name === name)
                    ) && (
                      <span className="ml-2 text-xs text-blue-500">(modified)</span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6 pt-2">
                    {categorySettings.map((setting) => (
                      <div key={setting.id} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label 
                            htmlFor={setting.name}
                            className="text-sm font-medium"
                          >
                            {setting.displayName}
                          </Label>
                          
                          {modifiedSettings[setting.name] !== undefined && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 py-1"
                              onClick={() => handleSaveSetting(setting.name)}
                              disabled={updateSettingMutation.isPending}
                            >
                              {updateSettingMutation.isPending ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              <span className="ml-1 text-xs">Save</span>
                            </Button>
                          )}
                        </div>
                        
                        <div className="space-y-1">
                          {renderSettingField(setting)}
                          <p className="text-xs text-muted-foreground">
                            {setting.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
      
      <CardFooter className="pt-2 text-xs text-muted-foreground">
        Changes will take effect immediately after saving
      </CardFooter>
    </Card>
  );
}