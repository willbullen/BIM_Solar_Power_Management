import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, AlertTriangle, Send, ActivitySquare } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

interface AgentTesterProps {
  selectedAgent?: any;
}

export function AgentTester({ selectedAgent }: AgentTesterProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetch agent status
  const { data: agentStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['/api/langchain/status'],
    queryFn: getQueryFn({ on401: 'throw' }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Test agent mutation
  const testAgentMutation = useMutation({
    mutationFn: async (data: { agentId: number; prompt: string }) => {
      setIsLoading(true);
      return await apiRequest('/api/langchain/test', {
        method: 'POST',
        data,
      });
    },
    onSuccess: (data) => {
      setResponse(data.response || "Agent responded successfully.");
      setIsLoading(false);
      toast({
        title: "Agent test completed",
        description: "The agent responded to your prompt.",
      });
    },
    onError: (error: any) => {
      setIsLoading(false);
      setResponse(`Error: ${error.message || "Failed to get response from agent."}`);
      toast({
        title: "Agent test failed",
        description: error.message || "There was an error testing the agent.",
        variant: "destructive",
      });
    },
  });

  // Health check query
  const { data: healthCheck } = useQuery({
    queryKey: ['/api/langchain/health'],
    queryFn: getQueryFn({ on401: 'throw' }),
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const handleTestAgent = () => {
    if (!selectedAgent) {
      toast({
        title: "No agent selected",
        description: "Please select an agent to test.",
        variant: "destructive",
      });
      return;
    }
    
    if (!prompt.trim()) {
      toast({
        title: "Empty prompt",
        description: "Please enter a prompt to test the agent.",
        variant: "destructive",
      });
      return;
    }
    
    testAgentMutation.mutate({
      agentId: selectedAgent.id,
      prompt: prompt.trim(),
    });
  };

  // Determine agent status indicators
  const isAgentOnline = healthCheck?.status === 'healthy';
  const hasActiveAgent = selectedAgent?.enabled && selectedAgent?.id;
  
  return (
    <Card className="mb-6">
      <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <ActivitySquare className="h-5 w-5 text-primary" />
            Agent Testing & Status
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant={isAgentOnline ? "outline" : "destructive"} 
              className={isAgentOnline ? "bg-green-950 text-green-400 border-green-700" : ""}
            >
              {isAgentOnline ? (
                <><Check className="mr-1 h-3 w-3" /> System Online</>
              ) : (
                <><AlertTriangle className="mr-1 h-3 w-3" /> System Offline</>
              )}
            </Badge>
            
            {selectedAgent && (
              <Badge 
                variant={hasActiveAgent ? "outline" : "secondary"}
                className={hasActiveAgent ? "bg-blue-950 text-blue-400 border-blue-700" : ""}
              >
                {hasActiveAgent ? "Agent Active" : "Agent Inactive"}
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Test your LangChain agent and view real-time status
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="text-sm font-medium">Test Prompt</div>
                {selectedAgent && (
                  <div className="text-xs text-muted-foreground">
                    Using Agent: {selectedAgent.name}
                  </div>
                )}
              </div>
              <Textarea 
                placeholder="Enter a prompt to test the agent..."
                className="min-h-[100px]"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <Button 
                className="w-full"
                disabled={isLoading || !selectedAgent}
                onClick={handleTestAgent}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!isLoading && <Send className="mr-2 h-4 w-4" />}
                Test Agent
              </Button>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <div className="space-y-2">
              <div className="text-sm font-medium">System Status</div>
              <div className="rounded-md border p-3 bg-slate-900 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">LangChain Service</div>
                  {isLoadingStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Badge 
                      variant={agentStatus?.langchainConnected ? "outline" : "destructive"}
                      className={agentStatus?.langchainConnected ? "bg-green-950 text-green-400 border-green-700" : ""}
                    >
                      {agentStatus?.langchainConnected ? "Connected" : "Disconnected"}
                    </Badge>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">OpenAI API</div>
                  {isLoadingStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Badge 
                      variant={agentStatus?.openaiConnected ? "outline" : "destructive"}
                      className={agentStatus?.openaiConnected ? "bg-green-950 text-green-400 border-green-700" : ""}
                    >
                      {agentStatus?.openaiConnected ? "Connected" : "Disconnected"}
                    </Badge>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">Tool Functions</div>
                  {isLoadingStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Badge 
                      variant={agentStatus?.toolsAvailable ? "outline" : "secondary"}
                      className={agentStatus?.toolsAvailable ? "bg-green-950 text-green-400 border-green-700" : ""}
                    >
                      {agentStatus?.toolsCount || 0} Available
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Response Area */}
        {(isLoading || response) && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Agent Response</div>
            <div className="rounded-md border p-3 bg-slate-900 min-h-[100px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Processing request...</span>
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap">{response}</div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}