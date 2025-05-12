import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getQueryFn, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileCode, Wand2, AlertCircle, Check, HelpCircle, Zap, Gauge, Clock, Text, Search } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

interface AgentTesterProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: number;
}

export function AgentTester({ isOpen, onClose, agentId }: AgentTesterProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>("results");
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fetch agent details if agentId is provided
  const { data: agent } = useQuery({
    queryKey: ['/api/langchain/agents', agentId],
    queryFn: async ({ queryKey }) => {
      const url = `/api/langchain/agents/${agentId}`;
      const response = await fetch(`${window.location.origin}${url}`, {
        credentials: "include",
        mode: "cors",
        cache: "no-cache",
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch agent details');
      }
      return await response.json();
    },
    enabled: !!agentId && isOpen,
  });

  // Fetch system status
  const { data: status = { 
      langchainConnected: false, 
      openaiConnected: false, 
      toolsAvailable: 0,
      toolsCount: 0 
    }
  } = useQuery({
    queryKey: ['/api/langchain/status'],
    queryFn: async ({ queryKey }) => {
      const response = await fetch(`${window.location.origin}${queryKey[0]}`, {
        credentials: "include",
        mode: "cors",
        cache: "no-cache",
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      return await response.json();
    },
    enabled: isOpen,
    refetchInterval: 30000,
  });

  // Create a mutation for testing the agent
  const testMutation = useMutation({
    mutationFn: async (data: { agentId: number; input: string }) => {
      setLoading(true);
      try {
        const response = await fetch(`${window.location.origin}/api/langchain/agents/${data.agentId}/test`, {
          method: 'POST',
          credentials: "include",
          mode: "cors",
          cache: "no-cache",
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ input: data.input })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Test failed: ${errorText}`);
        }
        
        return await response.json();
      } finally {
        setLoading(false);
      }
    },
    onSuccess: (data) => {
      setTestResults(data);
      setActiveTab("results");
      toast({
        title: "Test completed",
        description: "The agent has processed your request successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test failed",
        description: error.message || "There was an error testing the agent.",
        variant: "destructive",
      });
    },
  });

  const handleTest = () => {
    if (!query.trim()) {
      toast({
        title: "Input required",
        description: "Please enter a question or prompt to test the agent.",
        variant: "destructive",
      });
      return;
    }
    
    if (!agentId) {
      toast({
        title: "No agent selected",
        description: "Please select an agent to test.",
        variant: "destructive",
      });
      return;
    }
    
    testMutation.mutate({ agentId, input: query });
  };

  // Format timestamps
  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'HH:mm:ss.SSS');
    } catch (e) {
      return 'Invalid time';
    }
  };

  // Render the system status indicators
  const renderSystemStatus = () => {
    return (
      <div className="flex flex-wrap gap-3">
        <Card className="w-full">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">LangChain Agent System Status</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* LangChain Connection Status */}
              <div className="flex items-center gap-2 border rounded-md p-2">
                <div className={`rounded-full h-2 w-2 ${status?.langchainConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div className="font-medium text-sm">LangChain</div>
                <div className="text-xs text-muted-foreground ml-auto">
                  {status?.langchainConnected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              
              {/* OpenAI Connection Status */}
              <div className="flex items-center gap-2 border rounded-md p-2">
                <div className={`rounded-full h-2 w-2 ${status?.openaiConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div className="font-medium text-sm">OpenAI API</div>
                <div className="text-xs text-muted-foreground ml-auto">
                  {status?.openaiConnected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              
              {/* Tools Status */}
              <div className="flex items-center gap-2 border rounded-md p-2">
                <div className={`rounded-full h-2 w-2 ${status?.toolsAvailable > 0 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <div className="font-medium text-sm">Tools</div>
                <div className="text-xs text-muted-foreground ml-auto">
                  {status?.toolsCount || 0} Available
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render the test results
  const renderTestResults = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-[300px]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Testing agent...</p>
          </div>
        </div>
      );
    }

    if (!testResults) {
      return (
        <div className="flex items-center justify-center h-[300px]">
          <div className="flex flex-col items-center gap-2">
            <HelpCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Enter a question or prompt and click "Test Agent" to see results
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          {/* Execution metrics */}
          <Card className="w-full">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Execution Metrics</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 py-2">
              {/* Tokens Used */}
              <div className="flex flex-col gap-1 border rounded-md p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Zap className="h-3 w-3" /> Tokens
                </div>
                <div className="text-xl font-medium">
                  {testResults.tokenUsage?.total || 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  Prompt: {testResults.tokenUsage?.prompt || 0} | 
                  Completion: {testResults.tokenUsage?.completion || 0}
                </div>
              </div>
              
              {/* Duration */}
              <div className="flex flex-col gap-1 border rounded-md p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> Duration
                </div>
                <div className="text-xl font-medium">
                  {testResults.executionTime ? `${(testResults.executionTime / 1000).toFixed(2)}s` : 'Unknown'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total execution time
                </div>
              </div>
              
              {/* Iterations */}
              <div className="flex flex-col gap-1 border rounded-md p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Gauge className="h-3 w-3" /> Iterations
                </div>
                <div className="text-xl font-medium">
                  {testResults.iterations || 1}
                </div>
                <div className="text-xs text-muted-foreground">
                  Agent reasoning steps
                </div>
              </div>
              
              {/* Model */}
              <div className="flex flex-col gap-1 border rounded-md p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Text className="h-3 w-3" /> Model
                </div>
                <div className="text-xl font-medium truncate" title={testResults.model || 'Unknown'}>
                  {testResults.model || 'Unknown'}
                </div>
                <div className="text-xs text-muted-foreground">
                  LLM used for execution
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Input/Output display */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              <div className="flex justify-between items-center">
                <span>Input and Response</span>
                <Badge variant="outline" className="text-xs">
                  {formatTime(testResults.timestamp)}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 py-2">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Input</div>
              <div className="p-3 bg-muted rounded-md text-sm">{testResults.input}</div>
            </div>
            
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Response</div>
              <ScrollArea className="h-[200px]">
                <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {testResults.output || 'No response generated'}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
        
        {/* Tool usage */}
        {testResults.toolUsage && testResults.toolUsage.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Tool Usage</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {testResults.toolUsage.map((tool: any, index: number) => (
                    <div key={index} className="border rounded-md p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <FileCode className="h-4 w-4 text-primary" />
                        <div className="font-medium">{tool.name}</div>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {formatTime(tool.timestamp)}
                        </Badge>
                      </div>
                      
                      <div className="text-xs mb-1 text-muted-foreground">Arguments:</div>
                      <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto">
                        {JSON.stringify(tool.args, null, 2)}
                      </pre>
                      
                      {tool.result && (
                        <>
                          <div className="text-xs mt-2 mb-1 text-muted-foreground">Result:</div>
                          <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto">
                            {typeof tool.result === 'object' 
                              ? JSON.stringify(tool.result, null, 2) 
                              : tool.result}
                          </pre>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            {agent && typeof agent === 'object' && 'name' in agent ? `Test Agent: ${agent.name}` : 'Agent Tester'}
          </DialogTitle>
          <DialogDescription>
            Test the agent with custom inputs and analyze its performance
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="input" value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="input" className="flex items-center gap-1">
              <Search className="h-4 w-4" /> Input
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-1">
              <FileCode className="h-4 w-4" /> Results
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="input" className="space-y-4 pt-4">
            {renderSystemStatus()}
            
            <div className="space-y-2">
              <label htmlFor="testInput" className="text-sm font-medium">
                Test Query
              </label>
              <Textarea
                id="testInput"
                placeholder="Enter a question or prompt to test the agent..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            
            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleTest}
                disabled={loading || !query.trim()}
                className="gap-1"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Test Agent
              </Button>
            </DialogFooter>
          </TabsContent>
          
          <TabsContent value="results" className="space-y-4 pt-4">
            {renderTestResults()}
            
            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => setActiveTab("input")}
                className="gap-1"
              >
                <Search className="h-4 w-4" /> New Test
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}