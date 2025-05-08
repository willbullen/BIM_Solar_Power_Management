import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  Clock, 
  ClockIcon, 
  Settings,
  PiggyBank,
  CalendarClock,
  Zap
} from 'lucide-react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SchedulingAdvisor } from '@/components/scheduling-advisor';

export function OperationalPlanningPage() {
  const [activeTab, setActiveTab] = useState('advisor');
  
  return (
    <div className="container mx-auto p-4">
      <Helmet>
        <title>Operational Planning - Emporium</title>
      </Helmet>
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operational Planning</h1>
          <p className="text-muted-foreground">
            Optimize equipment scheduling based on solar forecasts and energy prices
          </p>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="advisor" className="flex items-center gap-1">
            <Zap className="h-4 w-4" />
            <span>Scheduling Advisor</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>Planning Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="savings" className="flex items-center gap-1">
            <PiggyBank className="h-4 w-4" />
            <span>Savings Simulation</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="advisor" className="space-y-4">
          <SchedulingAdvisor />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-primary" />
                  Operational Flexibility
                </CardTitle>
                <CardDescription>
                  Equipment operation time flexibility
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Main Refrigeration</span>
                    <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Low</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Processing Line A</span>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Medium</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Processing Line B</span>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">High</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Packaging System</span>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">High</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Solar Utilization
                </CardTitle>
                <CardDescription>
                  Current solar energy utilization rate
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Today</span>
                    <span className="text-sm font-medium">76%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-[76%]" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Weekly Average</span>
                    <span className="text-sm font-medium">64%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 w-[64%]" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-primary" />
                  Potential Savings
                </CardTitle>
                <CardDescription>
                  Estimated cost savings from optimization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Daily</span>
                    <span className="text-sm font-medium text-green-500">€24.50</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Weekly</span>
                    <span className="text-sm font-medium text-green-500">€171.50</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Monthly (Projected)</span>
                    <span className="text-sm font-medium text-green-500">€735.00</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Annual (Projected)</span>
                    <span className="text-sm font-medium text-green-500">€8,942.50</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Planning Calendar</CardTitle>
              <CardDescription>
                Visual calendar view of scheduled operations and forecasted solar generation
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                  <CalendarClock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Calendar View Coming Soon</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md">
                    The visual planning calendar is under development and will be available in a future update.
                  </p>
                  <Button variant="outline" disabled>Check Back Later</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="savings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Savings Simulation</CardTitle>
              <CardDescription>
                Simulate potential savings by applying recommended scheduling changes
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                  <PiggyBank className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Savings Simulator Coming Soon</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md">
                    The savings simulation tool is under development and will be available in a future update.
                  </p>
                  <Button variant="outline" disabled>Check Back Later</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}