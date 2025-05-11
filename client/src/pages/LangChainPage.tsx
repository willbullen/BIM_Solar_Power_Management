import React from 'react';
import { LangChainChat } from '@/components/langchain/LangChainChat';
import SharedLayout from '@/components/ui/shared-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatabaseIcon, FileTextIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function LangChainPage() {
  const { user } = useAuth();
  
  return (
    <SharedLayout user={user}>
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-2">LangChain AI Assistant</h1>
        <p className="text-muted-foreground mb-6">AI-powered database insights and report generation</p>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left panel - AI Chat */}
          <div className="lg:col-span-8">
            <LangChainChat />
          </div>
          
          {/* Right panel - Info & Tools */}
          <div className="lg:col-span-4">
            <Tabs defaultValue="info">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1">Information</TabsTrigger>
                <TabsTrigger value="examples" className="flex-1">Examples</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <DatabaseIcon className="w-5 h-5 mr-2" />
                      Database Access
                    </CardTitle>
                    <CardDescription>
                      Query the database for insights
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      The AI Assistant can safely query the database to retrieve information. It uses parameterized queries and access controls to ensure data integrity and security.
                    </p>
                    <ul className="mt-2 text-sm list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Data can be filtered and sorted</li>
                      <li>Results are returned as structured JSON</li>
                      <li>Database schema is automatically detected</li>
                    </ul>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileTextIcon className="w-5 h-5 mr-2" />
                      Report Generation
                    </CardTitle>
                    <CardDescription>
                      Create formatted reports from data
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      The AI can compile data into formatted reports with analysis and visualizations. Reports can be generated in Markdown or PDF format.
                    </p>
                    <ul className="mt-2 text-sm list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Statistical analysis of numeric data</li>
                      <li>Customizable report templates</li>
                      <li>PDF export with professional formatting</li>
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="examples" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Example Prompts</CardTitle>
                    <CardDescription>
                      Try these example queries with the AI Assistant
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="border rounded-md p-3">
                      <h4 className="font-medium mb-1">Database Queries</h4>
                      <ul className="text-sm space-y-2 text-muted-foreground">
                        <li>"Show me the most recent power data records"</li>
                        <li>"What's the average grid power usage?"</li>
                        <li>"List all the equipment with status 'operational'"</li>
                        <li>"Get environmental data from the last 24 hours"</li>
                      </ul>
                    </div>
                    
                    <div className="border rounded-md p-3">
                      <h4 className="font-medium mb-1">Report Generation</h4>
                      <ul className="text-sm space-y-2 text-muted-foreground">
                        <li>"Generate a report on power consumption trends"</li>
                        <li>"Create a PDF report of equipment efficiency data"</li>
                        <li>"Make a markdown summary of environmental conditions"</li>
                        <li>"Analyze the relationship between temperature and power usage"</li>
                      </ul>
                    </div>
                    
                    <div className="border rounded-md p-3">
                      <h4 className="font-medium mb-1">Complex Analysis</h4>
                      <ul className="text-sm space-y-2 text-muted-foreground">
                        <li>"Compare refrigeration efficiency between cold rooms"</li>
                        <li>"Find patterns in unaccounted load variations"</li>
                        <li>"Analyze maintenance impact on equipment performance"</li>
                        <li>"Calculate energy cost savings from solar output"</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </SharedLayout>
  );
}