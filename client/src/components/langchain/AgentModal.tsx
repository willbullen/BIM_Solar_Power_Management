import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentToolsSelector } from "./AgentToolsSelector";
import { Loader2, Save, X } from "lucide-react";

interface AgentModalProps {
  agent: any;
  isOpen: boolean;
  onClose: () => void;
  activeTab?: string;
}

export function AgentModal({ agent, isOpen, onClose, activeTab = "settings" }: AgentModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [currentTab, setCurrentTab] = useState(activeTab);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Initialize form when agent changes
  useEffect(() => {
    if (agent) {
      setName(agent.name || "");
      setDescription(agent.description || "");
      setSystemPrompt(agent.system_prompt || "");
      setEnabled(agent.enabled || false);
    }
  }, [agent]);

  // Set current tab when activeTab changes
  useEffect(() => {
    if (activeTab) {
      setCurrentTab(activeTab);
    }
  }, [activeTab]);

  // Update agent mutation
  const updateAgentMutation = useMutation({
    mutationFn: async (formData: any) => {
      return await apiRequest(`/api/langchain/agents/${agent.id}`, {
        method: "PATCH",
        data: formData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Agent updated",
        description: "The agent has been updated successfully.",
        variant: "default",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/langchain/agents"] });
      onClose();
    },
    onError: (error: Error) => {
      console.error("Failed to update agent", error);
      toast({
        title: "Failed to update agent",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async () => {
    if (!name) {
      toast({
        title: "Name is required",
        description: "Please provide a name for the agent.",
        variant: "destructive",
      });
      return;
    }

    await updateAgentMutation.mutateAsync({
      name,
      description,
      system_prompt: systemPrompt,
      enabled,
    });
  };

  const handleToolsChange = () => {
    // Just invalidate the queries when tools are changed
    queryClient.invalidateQueries({ queryKey: ["/api/langchain/agents"] });
    queryClient.invalidateQueries({ queryKey: ["/api/langchain/agent-tools", agent?.id] });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {agent ? `Edit Agent: ${agent.name}` : "Add New Agent"}
          </DialogTitle>
          <DialogDescription>
            Configure the agent's settings and tools.
          </DialogDescription>
        </DialogHeader>

        {agent && (
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="tools">Tools</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="py-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="agent-name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="agent-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="col-span-3"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="agent-description" className="text-right">
                    Description
                  </Label>
                  <Textarea
                    id="agent-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="col-span-3 min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="agent-system-prompt" className="text-right pt-2">
                    System Prompt
                  </Label>
                  <Textarea
                    id="agent-system-prompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="col-span-3 min-h-[200px] font-mono text-sm"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="agent-enabled" className="text-right">
                    Enabled
                  </Label>
                  <div className="flex items-center space-x-2 col-span-3">
                    <Switch
                      id="agent-enabled"
                      checked={enabled}
                      onCheckedChange={setEnabled}
                    />
                    <Label htmlFor="agent-enabled" className="cursor-pointer">
                      {enabled ? "Active" : "Inactive"}
                    </Label>
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="mr-2"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={updateAgentMutation.isPending}
                >
                  {updateAgentMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="tools" className="py-4">
              {agent && agent.id && (
                <AgentToolsSelector 
                  agentId={agent.id} 
                  onSuccess={handleToolsChange}
                />
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}