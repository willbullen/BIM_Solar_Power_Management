import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export default function AgentToolsDebugPage() {
  const [selectedAgentId, setSelectedAgentId] = useState(2); // Default to BillyBot
  const [debugResult, setDebugResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Query to get all LangChain agents
  const agentsQuery = useQuery<Agent[]>({
    queryKey: ['/api/langchain/agents'],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  // Query to get all available tools
  const toolsQuery = useQuery<Tool[]>({
    queryKey: ['/api/langchain/tools'],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  // Query to get a specific agent with its tools
  const agentQuery = useQuery<Agent>({
    queryKey: [`/api/langchain/agents/${selectedAgentId}`],
    enabled: !!selectedAgentId,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  // Fetch the debug data
  const fetchDebugData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/langchain/debug/agent-tools/${selectedAgentId}`);
      const data = await response.json();
      setDebugResult(data);
      console.log("Debug data:", data);
    } catch (error) {
      console.error("Error fetching debug data:", error);
      setDebugResult({ error: "Failed to fetch debug data" });
    } finally {
      setIsLoading(false);
    }
  };

  // Log query results
  useEffect(() => {
    if (agentsQuery.data) {
      console.log("All agents:", agentsQuery.data);
    }
    if (toolsQuery.data) {
      console.log("All tools:", toolsQuery.data);
    }
    if (agentQuery.data) {
      console.log(`Agent ${selectedAgentId} data:`, agentQuery.data);
      console.log(`Agent ${selectedAgentId} tools:`, agentQuery.data.tools);
    }
  }, [agentsQuery.data, toolsQuery.data, agentQuery.data, selectedAgentId]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Agent Tools Debug</h1>
      <p className="text-muted-foreground">
        This page helps debug the agent tools assignment functionality.
      </p>

      <Tabs defaultValue="debug">
        <TabsList>
          <TabsTrigger value="debug">Debug</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="debug" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Tools Debug</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="grid grid-cols-4 gap-4 items-center">
                  <Label htmlFor="agentId" className="text-right">Agent ID:</Label>
                  <Input 
                    id="agentId" 
                    type="number" 
                    value={selectedAgentId} 
                    onChange={(e) => setSelectedAgentId(parseInt(e.target.value))}
                    className="col-span-3" 
                  />
                </div>
                <Button onClick={fetchDebugData} disabled={isLoading}>
                  {isLoading ? "Loading..." : "Fetch Debug Data"}
                </Button>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-2">Regular API Response:</h3>
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-md">
                  <pre className="whitespace-pre-wrap text-sm">
                    {agentQuery.isLoading 
                      ? "Loading..." 
                      : agentQuery.error 
                        ? `Error: ${JSON.stringify(agentQuery.error, null, 2)}`
                        : !agentQuery.data
                          ? "No data"
                          : JSON.stringify(agentQuery.data, null, 2)
                    }
                  </pre>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-2">Debug API Response:</h3>
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-md">
                  <pre className="whitespace-pre-wrap text-sm">
                    {!debugResult 
                      ? "No debug data yet" 
                      : JSON.stringify(debugResult, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle>All Agents</CardTitle>
            </CardHeader>
            <CardContent>
              {agentsQuery.isLoading ? (
                <p>Loading agents...</p>
              ) : agentsQuery.error ? (
                <p className="text-red-500">Error loading agents</p>
              ) : (
                <div className="space-y-4">
                  {agentsQuery.data?.map((agent) => (
                    <div key={agent.id} className="border p-4 rounded-md">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">{agent.name} (ID: {agent.id})</h3>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedAgentId(agent.id)}
                        >
                          Select
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">{agent.description}</p>
                      <div className="mt-2">
                        <span className="text-sm font-medium">System Prompt:</span>
                        <p className="text-sm mt-1 bg-slate-50 dark:bg-slate-900 p-2 rounded-md">
                          {agent.systemPrompt ? agent.systemPrompt.substring(0, 100) + "..." : "No system prompt"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools">
          <Card>
            <CardHeader>
              <CardTitle>All Tools</CardTitle>
            </CardHeader>
            <CardContent>
              {toolsQuery.isLoading ? (
                <p>Loading tools...</p>
              ) : toolsQuery.error ? (
                <p className="text-red-500">Error loading tools</p>
              ) : (
                <div className="space-y-4">
                  {toolsQuery.data?.map((tool) => (
                    <div key={tool.id} className="border p-4 rounded-md">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">{tool.name} (ID: {tool.id})</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${tool.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {tool.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{tool.description}</p>
                      <p className="text-sm mt-1">Type: {tool.toolType}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}