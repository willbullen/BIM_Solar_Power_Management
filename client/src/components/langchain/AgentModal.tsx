import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { agentSchema, type AgentFormValues } from "@/lib/langchain-schemas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AgentToolsSelector } from "./AgentToolsSelector";

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent?: any; // Pass existing agent for editing
}

export function AgentModal({ isOpen, onClose, agent }: AgentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!agent;
  const [activeTab, setActiveTab] = useState<string>("settings");
  const [toolsUpdated, setToolsUpdated] = useState<boolean>(false);
  
  // Create form
  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: agent?.name || "",
      description: agent?.description || "",
      modelName: agent?.modelName || "gpt-4o",
      temperature: agent?.temperature || 0.7,
      maxTokens: agent?.maxTokens || 4000,
      streaming: agent?.streaming ?? true,
      systemPrompt: agent?.systemPrompt || "",
      maxIterations: agent?.maxIterations || 5,
      verbose: agent?.verbose ?? false,
      enabled: agent?.enabled ?? true,
    },
  });

  // Create or update agent mutation
  const mutation = useMutation({
    mutationFn: async (data: AgentFormValues) => {
      if (isEditing) {
        return await apiRequest(`/api/langchain/agents/${agent.id}`, {
          method: 'PATCH',
          data,
        });
      } else {
        return await apiRequest('/api/langchain/agents', {
          method: 'POST',
          data,
        });
      }
    },
    onSuccess: (data) => {
      toast({
        title: `Agent ${isEditing ? 'updated' : 'created'} successfully`,
        description: `The agent "${form.getValues().name}" has been ${isEditing ? 'updated' : 'created'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/agents'] });
      
      if (!isEditing && data?.id) {
        // If this is a new agent, update the agent reference with the newly created data
        // and switch to the tools tab instead of closing the modal
        agent = data;
        setActiveTab("tools");
      } else {
        onClose();
      }
    },
    onError: (error: any) => {
      toast({
        title: `Failed to ${isEditing ? 'update' : 'create'} agent`,
        description: error.message || `There was an error ${isEditing ? 'updating' : 'creating'} the agent.`,
        variant: "destructive",
      });
    },
  });

  // Form submission
  const onSubmit = (data: AgentFormValues) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} LangChain Agent</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the configuration for this LangChain agent and assign tools.' 
              : 'Create a new LangChain agent for AI interactions.'}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings">Agent Settings</TabsTrigger>
            <TabsTrigger value="tools" disabled={!isEditing}>
              Tools {toolsUpdated && "✓"}
            </TabsTrigger>
          </TabsList>
          
          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Agent" {...field} />
                      </FormControl>
                      <FormDescription>
                        A unique name for this agent
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="This agent helps with..." 
                          className="min-h-[80px]" 
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Brief description of the agent's purpose
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="modelName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                            <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Language model to use
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="maxTokens"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Tokens</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={100} 
                            max={8000} 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            value={field.value}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum response length
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperature: {field.value.toFixed(1)}</FormLabel>
                      <FormControl>
                        <Slider
                          min={0}
                          max={1}
                          step={0.1}
                          value={[field.value]}
                          onValueChange={(values) => field.onChange(values[0])}
                        />
                      </FormControl>
                      <FormDescription>
                        Lower values for more deterministic responses, higher for more creativity
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="systemPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Prompt</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="You are an AI assistant that..." 
                          className="min-h-[120px]" 
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Instructions that define the agent's behavior
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="maxIterations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Iterations</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            max={10} 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            value={field.value}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum steps for chain execution
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="streaming"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Streaming</FormLabel>
                          <FormDescription>
                            Enable streaming responses
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="verbose"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Verbose Mode</FormLabel>
                          <FormDescription>
                            Show detailed logs
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Enabled</FormLabel>
                        <FormDescription>
                          Agent is available for use
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button variant="outline" type="button" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEditing ? 'Update' : 'Create'} Agent
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
          
          {/* Tools Tab */}
          <TabsContent value="tools" className="space-y-4 mt-4">
            {isEditing && agent?.id ? (
              <Card>
                <CardContent className="p-4">
                  <AgentToolsSelector 
                    agentId={agent.id} 
                    onToolsChange={() => setToolsUpdated(true)}
                  />
                  
                  <div className="mt-6 flex justify-end">
                    <Button variant="outline" onClick={onClose}>
                      Close
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  Save the agent first to assign tools.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}