import { useState, useEffect } from "react";
import { Search, Loader2, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface DynamicToolRegistrationProps {
  onToolRegistered?: (tool: any) => void;
}

export function DynamicToolRegistration({ onToolRegistered }: DynamicToolRegistrationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [availableTools, setAvailableTools] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Mutation for registering a tool
  const registerToolMutation = useMutation({
    mutationFn: async (toolData: any) => {
      return await apiRequest('/api/langchain/tools/register', {
        method: 'POST',
        data: toolData,
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Tool registered successfully",
        description: `The tool "${data.name}" has been registered and is now available for use.`,
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/langchain/tools'] });
      if (onToolRegistered) {
        onToolRegistered(data);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to register tool",
        description: error.message || "There was an error registering the tool.",
        variant: "destructive",
      });
    },
  });

  // Effect to search for available tools
  useEffect(() => {
    if (!searchQuery.trim()) {
      setAvailableTools([]);
      return;
    }

    const searchTimer = setTimeout(() => {
      setIsLoading(true);
      
      // In a real implementation, this would call the backend to search for tools
      // For now, we'll simulate with some example tools
      const mockToolSearch = async () => {
        try {
          const response = await apiRequest(`/api/langchain/tools/search?query=${encodeURIComponent(searchQuery)}`, {
            method: 'GET',
          });
          
          setAvailableTools(response.tools || []);
        } catch (error) {
          console.error("Error searching for tools:", error);
          toast({
            title: "Search failed",
            description: "Failed to search for available tools.",
            variant: "destructive",
          });
          setAvailableTools([]);
        } finally {
          setIsLoading(false);
        }
      };
      
      mockToolSearch();
    }, 500);

    return () => clearTimeout(searchTimer);
  }, [searchQuery, toast]);

  // Handler for registering a tool
  const handleRegisterTool = (tool: any) => {
    registerToolMutation.mutate({
      name: tool.name,
      description: tool.description,
      toolType: tool.type || 'langchain',
      type: tool.type || 'custom',
      category: tool.category || 'Other',
      parameters: tool.parameters || {},
      implementation: tool.implementation || tool.name,
      enabled: true,
      isBuiltIn: false,
      metadata: {
        source: 'langchain_toolkit',
        originalName: tool.name,
        category: tool.category || 'Other',
        type: tool.type || 'custom'
      }
    });
  };

  return (
    <Card className="border-dashed border-2 border-indigo-300/20 bg-indigo-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-indigo-300">Dynamic Tool Registration</CardTitle>
        <CardDescription>
          Search and register new LangChain tools on-the-fly
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for tools..."
              className="pl-9 bg-background/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : availableTools.length > 0 ? (
            <ScrollArea className="h-64 rounded-md border p-2">
              <div className="space-y-3">
                {availableTools.map((tool: any) => (
                  <div 
                    key={tool.name} 
                    className="flex justify-between items-start p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{tool.name}</h4>
                        <Badge variant="outline" className="bg-indigo-950/50 text-indigo-300 border-indigo-800">
                          {tool.type || "LangChain"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {tool.description || "No description available"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1 h-8 ml-2 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border-indigo-800"
                      onClick={() => handleRegisterTool(tool)}
                      disabled={registerToolMutation.isPending}
                    >
                      {registerToolMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Plus className="h-3 w-3 mr-1" />
                      )}
                      Register
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : searchQuery.trim() !== "" ? (
            <div className="h-32 flex flex-col items-center justify-center text-center p-4 rounded-md border border-dashed">
              <p className="text-sm text-muted-foreground">No tools found for "{searchQuery}"</p>
              <p className="text-xs mt-1 text-muted-foreground/70">Try a different search term</p>
            </div>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center text-center p-4 rounded-md border border-dashed">
              <p className="text-sm text-muted-foreground">Enter a search term to find available tools</p>
              <p className="text-xs mt-1 text-muted-foreground/70">Example: "file", "web", "math"</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}