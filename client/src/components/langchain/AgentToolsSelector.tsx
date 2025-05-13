import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowUp, ArrowDown, Save, Loader2 } from "lucide-react";
import { getQueryFn } from "@/lib/queryClient"; 
import { Card, CardContent } from "@/components/ui/card";

interface Tool {
  id: number;
  name: string;
  description: string;
  type: string;
  function_def?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface AgentTool {
  id?: number;
  agentId: number;
  toolId: number;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

interface AgentToolsProps {
  agentId: number;
  onSuccess?: () => void;
}

export function AgentToolsSelector({ agentId, onSuccess }: AgentToolsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTools, setSelectedTools] = useState<Map<number, boolean>>(new Map());
  const [toolPriorities, setToolPriorities] = useState<Map<number, number>>(new Map());
  
  // Fetch all available tools
  const { 
    data: tools = [], 
    isLoading: isLoadingTools 
  } = useQuery({
    queryKey: ['/api/langchain/tools'],
    queryFn: getQueryFn({ on401: "ignore" }),
    enabled: Boolean(agentId),
  });
  
  // Fetch agent tools
  const { 
    data: agentTools = [], 
    isLoading: isLoadingAgentTools 
  } = useQuery({
    queryKey: ['/api/langchain/agent-tools', agentId],
    queryFn: getQueryFn({ on401: "ignore" }),
    enabled: Boolean(agentId),
  });

  // Initialize selectedTools and priorities from fetched data
  useEffect(() => {
    if (tools && agentTools && !isLoadingTools && !isLoadingAgentTools) {
      // Initialize all tools as unselected
      const toolSelections = new Map<number, boolean>();
      const priorities = new Map<number, number>();
      
      // Mark all tools as unselected initially
      if (Array.isArray(tools)) {
        tools.forEach((tool: Tool) => {
          toolSelections.set(tool.id, false);
          priorities.set(tool.id, 100); // Default priority
        });
      }
      
      // Update with the actual agent tool selections
      if (Array.isArray(agentTools)) {
        agentTools.forEach((agentTool: AgentTool) => {
          toolSelections.set(agentTool.toolId, true);
          priorities.set(agentTool.toolId, agentTool.priority);
        });
      }
      
      setSelectedTools(toolSelections);
      setToolPriorities(priorities);
    }
  }, [tools, agentTools, isLoadingTools, isLoadingAgentTools]);

  // Save tools mutation
  const saveToolsMutation = useMutation({
    mutationFn: async (formData: { agentId: number, tools: { toolId: number, priority: number }[] }) => {
      return await apiRequest(`/api/langchain/agents/${agentId}/tools`, {
        method: "PUT",
        data: formData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Tools updated",
        description: "The agent tools have been updated successfully.",
        variant: "default",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/agent-tools', agentId] });
      
      // Call the success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      console.error("Failed to update agent tools", error);
      toast({
        title: "Failed to update tools",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  // Handle tool selection
  const handleToolSelect = (toolId: number, isSelected: boolean) => {
    setSelectedTools(new Map(selectedTools.set(toolId, isSelected)));
  };

  // Handle priority change
  const handlePriorityChange = (toolId: number, priority: number) => {
    setToolPriorities(new Map(toolPriorities.set(toolId, priority)));
  };

  // Move priority up (lower number = higher priority)
  const handlePriorityUp = (toolId: number) => {
    const currentPriority = toolPriorities.get(toolId) || 100;
    if (currentPriority > 1) {
      handlePriorityChange(toolId, currentPriority - 1);
    }
  };

  // Move priority down
  const handlePriorityDown = (toolId: number) => {
    const currentPriority = toolPriorities.get(toolId) || 100;
    handlePriorityChange(toolId, currentPriority + 1);
  };

  // Save changes
  const handleSaveChanges = async () => {
    // Prepare data for submission
    const selectedToolsData = Array.from(selectedTools.entries())
      .filter(([_, isSelected]) => isSelected)
      .map(([toolId, _]) => ({
        toolId,
        priority: toolPriorities.get(toolId) || 100
      }));

    await saveToolsMutation.mutateAsync({
      agentId,
      tools: selectedToolsData
    });
  };

  if (isLoadingTools || isLoadingAgentTools) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading tools...</p>
      </div>
    );
  }

  // Sort tools by priority for display (if they are selected)
  const sortedTools = Array.isArray(tools) ? [...tools].sort((a, b) => {
    const aPriority = selectedTools.get(a.id) ? (toolPriorities.get(a.id) || 100) : 999;
    const bPriority = selectedTools.get(b.id) ? (toolPriorities.get(b.id) || 100) : 999;
    return aPriority - bPriority;
  }) : [];

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium">Agent Tools Configuration</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select which tools this agent can use, and set their priority order.
          Tools with lower priority numbers will be tried first.
        </p>
      </div>

      <div className="grid gap-4">
        {sortedTools.map((tool) => (
          <Card key={tool.id} className={selectedTools.get(tool.id) ? "border-primary" : ""}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-5 items-center pt-1">
                  <Checkbox
                    id={`tool-${tool.id}`}
                    checked={selectedTools.get(tool.id) || false}
                    onCheckedChange={(checked) => 
                      handleToolSelect(tool.id, checked === true)
                    }
                  />
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center">
                    <Label
                      htmlFor={`tool-${tool.id}`}
                      className="font-medium cursor-pointer flex-1"
                    >
                      {tool.name}
                    </Label>
                    
                    {selectedTools.get(tool.id) && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Priority:
                        </span>
                        <div className="flex items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handlePriorityUp(tool.id)}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            max="999"
                            value={toolPriorities.get(tool.id) || 100}
                            onChange={(e) => 
                              handlePriorityChange(tool.id, parseInt(e.target.value) || 100)
                            }
                            className="h-8 w-16 text-center mx-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handlePriorityDown(tool.id)}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {tool.description}
                  </p>
                  {tool.type && (
                    <div className="text-xs text-gray-400 mt-1">
                      Type: {tool.type}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {Array.isArray(tools) && tools.length === 0 && (
          <div className="text-center p-8 border border-dashed rounded-md">
            <p className="text-gray-500">No tools available.</p>
          </div>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <Button
          onClick={handleSaveChanges}
          disabled={saveToolsMutation.isPending}
        >
          {saveToolsMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Tools Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
}