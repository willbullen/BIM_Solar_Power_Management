import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toolSchema, type ToolFormValues } from "@/lib/langchain-schemas";

interface ToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  tool?: any; // Pass existing tool for editing
}

export function ToolModal({ isOpen, onClose, tool }: ToolModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!tool;
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [categoryType, setCategoryType] = useState<string>("Other");
  
  // Fetch available agents
  const { data: agentsData } = useQuery({
    queryKey: ['/api/langchain/agents'],
    enabled: isOpen,
  });
  
  // Ensure agents is always a properly typed array
  const agents: Array<{id: number|string, name: string}> = Array.isArray(agentsData) ? agentsData : [];
  
  // Create form
  const form = useForm<ToolFormValues>({
    resolver: zodResolver(toolSchema),
    defaultValues: {
      name: tool?.name || "",
      description: tool?.description || "",
      toolType: tool?.toolType || "custom",
      parameters: tool?.parameters || {},
      implementation: tool?.implementation || "",
      enabled: tool?.enabled ?? true,
      isBuiltIn: tool?.isBuiltIn ?? false,
      metadata: tool?.metadata || {},
    },
  });

  // Create or update tool mutation
  const mutation = useMutation({
    mutationFn: async (data: ToolFormValues) => {
      if (isEditing) {
        return await apiRequest(`/api/langchain/tools/${tool.id}`, {
          method: 'PATCH',
          data,
        });
      } else {
        return await apiRequest('/api/langchain/tools', {
          method: 'POST',
          data,
        });
      }
    },
    onSuccess: () => {
      toast({
        title: `Tool ${isEditing ? 'updated' : 'created'} successfully`,
        description: `The tool "${form.getValues().name}" has been ${isEditing ? 'updated' : 'created'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/tools'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: `Failed to ${isEditing ? 'update' : 'create'} tool`,
        description: error.message || `There was an error ${isEditing ? 'updating' : 'creating'} the tool.`,
        variant: "destructive",
      });
    },
  });

  // Form submission
  const onSubmit = (data: ToolFormValues) => {
    // Add agent assignment and category information if provided
    const submissionData = {
      ...data,
      category: categoryType,
      agentId: selectedAgentId || undefined,
      metadata: {
        ...data.metadata || {},
        category: categoryType
      }
    };
    
    console.log('Submitting tool data:', submissionData);
    mutation.mutate(submissionData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} LangChain Tool</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the configuration for this LangChain tool.' 
              : 'Create a new LangChain tool for AI interactions.'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tool Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Tool" {...field} />
                  </FormControl>
                  <FormDescription>
                    A unique name for this tool
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
                      placeholder="This tool helps with..." 
                      className="min-h-[80px]" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Brief description of the tool's purpose
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="toolType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tool Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a tool type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="custom">Custom</SelectItem>
                      <SelectItem value="readFromDB">Read From Database</SelectItem>
                      <SelectItem value="compileReport">Compile Report</SelectItem>
                      <SelectItem value="httpRequest">HTTP Request</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Type of functionality this tool provides
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="implementation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Implementation</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="async function(args) { ... }" 
                      className="min-h-[150px] font-mono text-sm" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    JavaScript implementation for custom tools
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="example"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Example Usage</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Tool.search('query')" 
                      className="min-h-[80px] font-mono text-sm" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Example of how to use this tool (shown in UI to help users understand its usage)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Parameters Section */}
            <div>
              <h3 className="text-lg font-medium mb-2">Tool Parameters</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Define the parameters this tool accepts. Parameters will be validated when the tool is used.
              </p>
              
              <div className="space-y-4 p-4 border rounded-md bg-card/50">
                <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground">
                  <div>Parameter Name</div>
                  <div>Type</div>
                  <div>Required</div>
                  <div>Description</div>
                </div>
                
                {/* Parameter Editor - functional implementation */}
                <div className="space-y-4">
                  {form.watch('parameters') && Object.entries(form.watch('parameters') || {}).map(([paramName, paramConfig]: [string, any], index) => (
                    <div key={`param-${index}`} className="grid grid-cols-4 gap-4 items-center border-b pb-3">
                      <div>
                        <Input 
                          value={paramName} 
                          onChange={(e) => {
                            const newParams = {...form.watch('parameters')};
                            const paramValue = newParams[paramName];
                            delete newParams[paramName];
                            newParams[e.target.value] = paramValue;
                            form.setValue('parameters', newParams);
                          }}
                          placeholder="e.g. query" 
                        />
                      </div>
                      <Select 
                        defaultValue={paramConfig?.type || "string"}
                        onValueChange={(value) => {
                          const newParams = {...form.watch('parameters')};
                          newParams[paramName] = {
                            ...newParams[paramName],
                            type: value
                          };
                          form.setValue('parameters', newParams);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">String</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="boolean">Boolean</SelectItem>
                          <SelectItem value="object">Object</SelectItem>
                          <SelectItem value="array">Array</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center">
                        <Switch 
                          checked={paramConfig?.required || false}
                          onCheckedChange={(checked) => {
                            const newParams = {...form.watch('parameters')};
                            newParams[paramName] = {
                              ...newParams[paramName],
                              required: checked
                            };
                            form.setValue('parameters', newParams);
                          }}
                          id={`param-required-${index}`} 
                        />
                        <label htmlFor={`param-required-${index}`} className="ml-2 text-sm">Required</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={paramConfig?.description || ""}
                          onChange={(e) => {
                            const newParams = {...form.watch('parameters')};
                            newParams[paramName] = {
                              ...newParams[paramName],
                              description: e.target.value
                            };
                            form.setValue('parameters', newParams);
                          }}
                          placeholder="Parameter description"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newParams = {...form.watch('parameters')};
                            delete newParams[paramName];
                            form.setValue('parameters', newParams);
                          }}
                          className="flex-shrink-0 text-destructive hover:text-destructive/90"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-2"
                    onClick={() => {
                      // Create a unique parameter name
                      const newParamName = `param${Object.keys(form.watch('parameters') || {}).length + 1}`;
                      const currentParams = form.watch('parameters') || {};
                      form.setValue('parameters', {
                        ...currentParams,
                        [newParamName]: {
                          type: 'string',
                          description: '',
                          required: false
                        }
                      });
                    }}
                  >
                    + Add Parameter
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Enabled</FormLabel>
                      <FormDescription>
                        Tool is available for use
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
                name="isBuiltIn"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Built-in Tool</FormLabel>
                      <FormDescription>
                        System tool with protected implementation
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!isEditing || tool?.isBuiltIn}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Category Selection */}
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select 
                onValueChange={setCategoryType} 
                defaultValue={categoryType}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Data Processing">Data Processing</SelectItem>
                  <SelectItem value="Information Retrieval">Information Retrieval</SelectItem>
                  <SelectItem value="System Integration">System Integration</SelectItem>
                  <SelectItem value="Data Services">Data Services</SelectItem>
                  <SelectItem value="Language Processing">Language Processing</SelectItem>
                  <SelectItem value="Content Generation">Content Generation</SelectItem>
                  <SelectItem value="Environmental Data">Environmental Data</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Group similar tools together in meaningful categories
              </FormDescription>
            </FormItem>
            
            {/* Agent Assignment */}
            {!isEditing && (
              <FormItem>
                <FormLabel>Assign to Agent</FormLabel>
                <Select 
                  onValueChange={setSelectedAgentId} 
                  defaultValue=""
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an agent (optional)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">None (Register tool only)</SelectItem>
                    {Array.isArray(agents) && agents.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id.toString()}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Automatically assign this tool to an agent upon registration
                </FormDescription>
              </FormItem>
            )}

            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Update' : 'Create'} Tool
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}