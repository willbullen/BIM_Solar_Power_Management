import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentChat } from '@/components/agent/agent-chat';
import { AgentTasks } from '@/components/agent/agent-tasks';
import { AgentSettings } from '@/components/agent/agent-settings';
import { AgentNotifications } from '@/components/agent/agent-notifications';
import { AgentTestPanel } from '@/components/agent/agent-test';
import { Bot, Calendar, Settings, Bell, Bug } from 'lucide-react';

export function AgentPage() {
  const [activeTab, setActiveTab] = useState('chat');
  
  return (
    <div className="container py-6 space-y-6">
      <Helmet>
        <title>AI Energy Advisor | Emporium Power</title>
      </Helmet>
      
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-3/4 space-y-6">
          <header>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Bot className="h-8 w-8" />
              AI Energy Advisor
            </h1>
            <p className="text-muted-foreground mt-1">
              Get insights, reports, and recommendations from your intelligent energy assistant
            </p>
          </header>
          
          <Tabs 
            defaultValue="chat" 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="chat" className="flex items-center gap-1">
                <Bot className="h-4 w-4" />
                <span>Chat</span>
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Tasks</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-1">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </TabsTrigger>
              <TabsTrigger value="debug" className="flex items-center gap-1">
                <Bug className="h-4 w-4" />
                <span>Debug</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="chat" className="pt-4">
              <AgentChat />
            </TabsContent>
            
            <TabsContent value="tasks" className="pt-4">
              <AgentTasks />
            </TabsContent>
            
            <TabsContent value="settings" className="pt-4">
              <AgentSettings />
            </TabsContent>
            
            <TabsContent value="debug" className="pt-4">
              <AgentTestPanel />
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="md:w-1/4">
          <AgentNotifications />
        </div>
      </div>
    </div>
  );
}