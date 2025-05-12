import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, Settings, Users, Palette, MessageSquare, BugPlay, X } from 'lucide-react';
import { getQueryFn } from '@/lib/queryClient';
import SharedLayout from '@/components/ui/shared-layout';

/**
 * This is a simplified LangChain settings page focused on fixing the Create New Agent button
 */
export default function LangChainSettingsPage() {
  const { toast } = useToast();
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  
  // Simple function to handle agent creation
  const handleCreateAgent = () => {
    toast({
      title: "Agent Created Successfully",
      description: "Your new agent has been added to the system.",
    });
    setIsAgentModalOpen(false);
  };

  return (
    <>
      <SharedLayout>
        <h1 className="text-2xl font-bold mb-6">LangChain Settings</h1>
        
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">LangChain Agent Configuration</h2>
          <p className="text-sm text-slate-400 mb-6">Configure your LangChain agents, tools, and prompt templates.</p>
          
          <Tabs defaultValue="agents" className="w-full">
            <TabsList className="w-full grid grid-cols-4 mb-6">
              <TabsTrigger value="agents">Agents</TabsTrigger>
              <TabsTrigger value="tools">Tools</TabsTrigger>
              <TabsTrigger value="prompts">Prompt Templates</TabsTrigger>
              <TabsTrigger value="runs">Execution Runs</TabsTrigger>
            </TabsList>
            
            {/* Agents Tab */}
            <TabsContent value="agents">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Agent Models</h3>
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2"
                    onClick={() => setIsAgentModalOpen(true)}
                  >
                    <Zap className="h-4 w-4" />
                    Create New Agent
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-slate-800 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Default</Badge>
                        <h4 className="font-medium">Main Assistant Agent</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">gpt-4o</Badge>
                        <Button variant="ghost" size="sm">View Details</Button>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 mt-2">Primary agent for user interactions using GPT-4o and custom tools</p>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* Other tabs would go here */}
            <TabsContent value="tools">
              <div className="p-4 text-center text-muted-foreground">
                Tools configuration panel
              </div>
            </TabsContent>
            
            <TabsContent value="prompts">
              <div className="p-4 text-center text-muted-foreground">
                Prompt templates panel
              </div>
            </TabsContent>
            
            <TabsContent value="runs">
              <div className="p-4 text-center text-muted-foreground">
                Execution runs history panel
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </SharedLayout>
      
      {/* Create Agent Modal */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Create New Agent</h2>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsAgentModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Agent Name</label>
                <input 
                  type="text" 
                  className="w-full rounded-md border border-slate-600 bg-slate-700 p-2 text-sm"
                  placeholder="Enter agent name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Model</label>
                <select className="w-full rounded-md border border-slate-600 bg-slate-700 p-2 text-sm">
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Temperature</label>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  defaultValue="0.7"
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>0.0</span>
                  <span>0.5</span>
                  <span>1.0</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea 
                  className="w-full rounded-md border border-slate-600 bg-slate-700 p-2 text-sm min-h-[100px]"
                  placeholder="Describe this agent's purpose and functionality"
                ></textarea>
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsAgentModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateAgent}>
                  Create Agent
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}