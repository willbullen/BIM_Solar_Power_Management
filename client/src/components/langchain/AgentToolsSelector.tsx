import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, X, Plus, Settings } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Tool {
  id: number;
  name: string;
  description: string;
  toolType: string;
  enabled: boolean;
  priority?: number;
}

interface Agent {
  id: number;
  name: string;
  description?: string;
  tools: Tool[];
  [key: string]: any;
}

interface AgentToolsProps {
  agentId: number;
  onToolsChange?: () => void;
}

export function AgentToolsSelector({ agentId, onToolsChange }: AgentToolsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState<string>("0");
  
  // Query to get the current agent and its tools
  const agentQuery = useQuery<Agent>({ 
    queryKey: [`/api/langchain/agents/${agentId}`],
    enabled: !!agentId
  });
  
  // Query to get all available tools
  const toolsQuery = useQuery<Tool[]>({ 
    queryKey: ['/api/langchain/tools']
  });

  // Tools already assigned to the agent
  const assignedTools = agentQuery.data?.tools || [];
  
  // All available tools
  const allTools = toolsQuery.data || [];
  
  // Tools that are not yet assigned to the agent
  const unassignedTools = allTools.filter(
    (tool: Tool) => !assignedTools.some((t: Tool) => t.id === tool.id)
  );

  // Mutation to assign a tool to the agent
  const assignToolMutation = useMutation({
    mutationFn: (data: { agentId: number; toolId: number; priority: number }) => {
      return apiRequest(`/api/langchain/agent-tools`, {
        method: "POST",
        data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/langchain/agents/${agentId}`] });
      toast({
        title: "Tool assigned",
        description: "The tool has been assigned to the agent successfully.",
      });
      if (onToolsChange) onToolsChange();
      setIsAssignDialogOpen(false);
      setSelectedToolId("");
      setSelectedPriority("0");
    },
    onError: (error) => {
      toast({
        title: "Error assigning tool",
        description: error.message || "There was an error assigning the tool to the agent.",
        variant: "destructive",
      });
    },
  });

  // Mutation to remove a tool from the agent
  const removeToolMutation = useMutation({
    mutationFn: (data: { agentId: number; toolId: number }) => {
      return apiRequest(`/api/langchain/agent-tools`, {
        method: "DELETE",
        data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/langchain/agents/${agentId}`] });
      toast({
        title: "Tool removed",
        description: "The tool has been removed from the agent successfully.",
      });
      if (onToolsChange) onToolsChange();
    },
    onError: (error) => {
      toast({
        title: "Error removing tool",
        description: error.message || "There was an error removing the tool from the agent.",
        variant: "destructive",
      });
    },
  });

  // Mutation to update a tool's priority
  const updatePriorityMutation = useMutation({
    mutationFn: (data: { agentId: number; toolId: number; priority: number }) => {
      return apiRequest(`/api/langchain/agent-tools`, {
        method: "PATCH",
        data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/langchain/agents/${agentId}`] });
      toast({
        title: "Priority updated",
        description: "The tool priority has been updated successfully.",
      });
      if (onToolsChange) onToolsChange();
    },
    onError: (error) => {
      toast({
        title: "Error updating priority",
        description: error.message || "There was an error updating the tool priority.",
        variant: "destructive",
      });
    },
  });

  // Handle assigning a tool to the agent
  const handleAssignTool = () => {
    if (!selectedToolId) {
      toast({
        title: "No tool selected",
        description: "Please select a tool to assign to the agent.",
        variant: "destructive",
      });
      return;
    }

    assignToolMutation.mutate({
      agentId,
      toolId: parseInt(selectedToolId),
      priority: parseInt(selectedPriority),
    });
  };

  // Handle removing a tool from the agent
  const handleRemoveTool = (toolId: number) => {
    removeToolMutation.mutate({
      agentId,
      toolId,
    });
  };

  // Handle updating a tool's priority
  const handlePriorityChange = (toolId: number, priority: string) => {
    updatePriorityMutation.mutate({
      agentId,
      toolId,
      priority: parseInt(priority),
    });
  };

  // Check if loading
  const isLoading = agentQuery.isLoading || toolsQuery.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium mb-2">Assigned Tools</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAssignDialogOpen(true)}
          disabled={unassignedTools.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          Assign Tool
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : assignedTools.length === 0 ? (
        <div className="text-center p-4 border rounded-md bg-slate-50 dark:bg-slate-900">
          <p className="text-sm text-muted-foreground">
            No tools assigned to this agent yet
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignedTools
            .sort((a: Tool, b: Tool) => (a.priority || 0) - (b.priority || 0))
            .map((tool: Tool) => (
              <Card key={tool.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={tool.enabled ? "default" : "secondary"}
                        className="px-2 py-0 h-5"
                      >
                        {tool.toolType}
                      </Badge>
                      <div className="flex flex-col">
                        <span className="font-medium">{tool.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {tool.description}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Select
                        value={String(tool.priority || 0)}
                        onValueChange={(value) => handlePriorityChange(tool.id, value)}
                      >
                        <SelectTrigger className="w-20 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[...Array(10)].map((_, i) => (
                            <SelectItem key={i} value={String(i)}>
                              Priority {i}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTool(tool.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Dialog for assigning a new tool */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Tool to Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tool">Select Tool</Label>
              <Select
                value={selectedToolId}
                onValueChange={setSelectedToolId}
              >
                <SelectTrigger id="tool">
                  <SelectValue placeholder="Select a tool" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedTools.map((tool: Tool) => (
                    <SelectItem key={tool.id} value={String(tool.id)}>
                      {tool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={selectedPriority}
                onValueChange={setSelectedPriority}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...Array(10)].map((_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      Priority {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Lower priority tools are considered first by the agent
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAssignDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleAssignTool}
              disabled={assignToolMutation.isPending || !selectedToolId}
            >
              {assignToolMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Assign Tool
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}