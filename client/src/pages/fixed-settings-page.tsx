import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, Settings, CloudSun, Users, Palette, MessageSquare, BugPlay } from 'lucide-react';
import { getQueryFn } from '@/lib/queryClient';
import SharedLayout from '@/components/ui/shared-layout';

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  
  // Simplified for demo purposes
  return (
    <>
      <SharedLayout>
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-6 w-full md:w-fit">
            <TabsTrigger value="general">
              <Settings className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="langchain">
              <Zap className="h-4 w-4 mr-2" />
              LangChain
            </TabsTrigger>
          </TabsList>
        
          {/* Just the LangChain tab for now */}
          <TabsContent value="langchain">
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
                        onClick={() => {
                          console.log("Setting isAgentModalOpen to true");
                          setIsAgentModalOpen(true);
                        }}
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
              </Tabs>
            </Card>
          </TabsContent>
        </Tabs>
      </SharedLayout>
      
      {/* Agent Modal */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Create New Agent</h2>
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
                <label className="text-sm font-medium">Description</label>
                <textarea 
                  className="w-full rounded-md border border-slate-600 bg-slate-700 p-2 text-sm min-h-[100px]"
                  placeholder="Describe this agent's purpose and functionality"
                ></textarea>
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <Button variant="outline" onClick={() => setIsAgentModalOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  toast({
                    title: "Agent Created",
                    description: "Your new agent has been created successfully.",
                  });
                  setIsAgentModalOpen(false);
                }}>Create Agent</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}