import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Check, AlertTriangle, Send, ActivitySquare, 
  Clock, Zap, MessageSquare, Cpu, BarChart, Wrench, X
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

interface AgentTesterProps {
  selectedAgent?: any;
  onClearAgent?: () => void;
}

interface TestResult {
  response: string;
  executionTimeMs: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  modelName: string;
  timestamp: string;
  agentName: string;
  runId: string;
  hasToolCalls: boolean;
}

export function AgentTester({ selectedAgent, onClearAgent }: AgentTesterProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  
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
      setTestResult({
        response: data.response || 'No response from agent',
        executionTimeMs: data.executionTimeMs || 0,
        tokenUsage: {
          promptTokens: data.tokenUsage?.promptTokens || 0,
          completionTokens: data.tokenUsage?.completionTokens || 0,
          totalTokens: data.tokenUsage?.totalTokens || 0
        },
        modelName: data.modelName || 'unknown',
        timestamp: data.timestamp || new Date().toISOString(),
        agentName: data.agentName || selectedAgent?.name || 'Unknown Agent',
        runId: data.runId || 'unknown',
        hasToolCalls: data.hasToolCalls || false
      });
      setIsLoading(false);
      toast({
        title: "Agent test completed",
        description: "The agent responded to your prompt.",
      });
    },
    onError: (error: any) => {
      setIsLoading(false);
      setResponse(`Error: ${error.message || "Failed to get response from agent."}`);
      setTestResult(null);
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
  const isAgentSelected = !!selectedAgent;
  
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
            
            <Badge 
              variant={isAgentSelected ? (hasActiveAgent ? "outline" : "secondary") : "secondary"}
              className={hasActiveAgent ? "bg-blue-950 text-blue-400 border-blue-700" : ""}
            >
              {isAgentSelected ? (hasActiveAgent ? "Agent Active" : "Agent Inactive") : "No Agent Selected"}
            </Badge>
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
              
              {!selectedAgent ? (
                <div className="border rounded-md p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-3">Please select an agent to test by clicking the "Test Agent" button on any agent card below</p>
                  <span className="inline-flex items-center rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-slate-700">
                    <Zap className="mr-1 h-3 w-3"/> Test Agent
                  </span>
                </div>
              ) : (
                <>
                  <Textarea 
                    placeholder="Enter a prompt to test the agent..."
                    className="min-h-[100px]"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1"
                      disabled={isLoading}
                      onClick={handleTestAgent}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {!isLoading && <Send className="mr-2 h-4 w-4" />}
                      Test Agent
                    </Button>
                    
                    <Button 
                      variant="outline"
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800"
                      disabled={isLoading}
                      onClick={() => {
                        if (onClearAgent) {
                          setPrompt("");
                          setResponse("");
                          setTestResult(null);
                          onClearAgent();
                          toast({
                            title: "Test Mode Cancelled",
                            description: "Agent testing has been cancelled.",
                            variant: "default"
                          });
                        }
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel Test
                    </Button>
                  </div>
                </>
              )}
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
          <div className="space-y-4">
            <div className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Agent Response
            </div>
            <div className="rounded-md border p-4 bg-slate-900 min-h-[100px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Processing request...</span>
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap">{response}</div>
              )}
            </div>
            
            {/* Test Results Details */}
            {testResult && !isLoading && (
              <div className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <BarChart className="h-4 w-4" />
                    Test Results
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Run ID: {testResult.runId.substring(0, 8)}...
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Performance Metrics */}
                  <div className="rounded-md border p-4 bg-slate-900">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" /> Performance
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Execution Time</span>
                          <span className="font-medium">{(testResult.executionTimeMs / 1000).toFixed(2)}s</span>
                        </div>
                        <Progress 
                          value={Math.min(100, (testResult.executionTimeMs / 5000) * 100)} 
                          className="h-1.5" 
                        />
                      </div>
                      
                      <div className="flex justify-between text-xs mt-3">
                        <span className="text-muted-foreground">Model</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="font-medium bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                                {testResult.modelName}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Model used for this agent test</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Timestamp</span>
                        <span className="font-mono text-xs">
                          {new Date(testResult.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Token Usage */}
                  <div className="rounded-md border p-4 bg-slate-900">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" /> Token Usage
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Prompt Tokens</span>
                          <span>{testResult.tokenUsage.promptTokens}</span>
                        </div>
                        <Progress 
                          value={Math.min(100, (testResult.tokenUsage.promptTokens / 1000) * 100)} 
                          className="h-1.5 bg-slate-700" 
                        />
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Completion Tokens</span>
                          <span>{testResult.tokenUsage.completionTokens}</span>
                        </div>
                        <Progress 
                          value={Math.min(100, (testResult.tokenUsage.completionTokens / 1000) * 100)} 
                          className="h-1.5 bg-slate-700" 
                        />
                      </div>
                      
                      <div className="pt-2 mt-1 border-t border-slate-700">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">Total Tokens</span>
                          <Badge variant="outline" className="bg-slate-800">
                            {testResult.tokenUsage.totalTokens}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Tool Usage */}
                <div className="rounded-md border p-4 bg-slate-900">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-blue-500" /> Tool Usage
                    </h4>
                    <Badge 
                      variant={testResult.hasToolCalls ? "outline" : "secondary"}
                      className={testResult.hasToolCalls 
                        ? "bg-blue-950 text-blue-400 border-blue-700" 
                        : ""}
                    >
                      {testResult.hasToolCalls ? "Tools Used" : "No Tools Used"}
                    </Badge>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    {testResult.hasToolCalls 
                      ? "This agent execution used one or more tools. Check the logs for details." 
                      : "No tools were called during this execution."}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}