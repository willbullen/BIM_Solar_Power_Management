import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlusCircle, Save, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

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
  const [selectedTools, setSelectedTools] = useState<Map<number, boolean>>(new Map());
  const [toolPriorities, setToolPriorities] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all available tools
  const { data: tools, isLoading: isLoadingTools } = useQuery({
    queryKey: ['/api/langchain/tools'],
    enabled: Boolean(agentId),
  });

  // Fetch current agent tools
  const { data: agentTools, isLoading: isLoadingAgentTools } = useQuery({
    queryKey: ['/api/langchain/agent-tools', agentId],
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
        method: 'PUT',
        data: formData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Tools updated successfully",
        description: "Agent tools have been updated.",
        variant: "default",
      });
      
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/agent-tools', agentId] });
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/agents'] });
      
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

  const handleToolToggle = (toolId: number) => {
    setSelectedTools(prev => {
      const newMap = new Map(prev);
      newMap.set(toolId, !prev.get(toolId));
      return newMap;
    });
  };

  const handlePriorityChange = (toolId: number, priority: number) => {
    setToolPriorities(prev => {
      const newMap = new Map(prev);
      newMap.set(toolId, priority);
      return newMap;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    
    try {
      // Format tools data for API
      const toolsToSave = Array.from(selectedTools.entries())
        .filter(([_, isSelected]) => isSelected)
        .map(([toolId, _]) => ({
          toolId,
          priority: toolPriorities.get(toolId) || 100,
        }));
      
      await saveToolsMutation.mutateAsync({
        agentId,
        tools: toolsToSave,
      });
    } catch (error) {
      console.error("Error in handleSave", error);
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingTools || isLoadingAgentTools) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading tools...</span>
      </div>
    );
  }

  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-md text-center">
        <p className="text-gray-600 mb-2">No tools available</p>
        <p className="text-sm text-gray-500">
          Tools must be added to the system before they can be assigned to agents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-1">Available Tools</h3>
        <p className="text-sm text-gray-500 mb-4">
          Select tools for this agent and set their priority (lower numbers will be tried first).
        </p>
        
        <div className="space-y-3">
          {tools.map((tool: Tool) => (
            <Card key={tool.id} className={`border ${selectedTools.get(tool.id) ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2">
                    <Checkbox 
                      id={`tool-${tool.id}`} 
                      checked={selectedTools.get(tool.id) || false}
                      onCheckedChange={() => handleToolToggle(tool.id)}
                      className="mt-1"
                    />
                    <div>
                      <Label 
                        htmlFor={`tool-${tool.id}`} 
                        className="font-medium cursor-pointer"
                      >
                        {tool.name}
                        <Badge 
                          variant="outline" 
                          className="ml-2 text-xs bg-gray-100 hover:bg-gray-200"
                        >
                          {tool.type}
                        </Badge>
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                  
                  {selectedTools.get(tool.id) && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">Priority:</span>
                      <Input 
                        type="number" 
                        min="1"
                        max="1000"
                        value={toolPriorities.get(tool.id) || 100}
                        onChange={(e) => handlePriorityChange(tool.id, parseInt(e.target.value) || 100)}
                        className="w-20 h-8 text-sm"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={loading || saveToolsMutation.isPending}
          className="w-full sm:w-auto"
        >
          {(loading || saveToolsMutation.isPending) ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Tool Assignments
            </>
          )}
        </Button>
      </div>
    </div>
  );
}