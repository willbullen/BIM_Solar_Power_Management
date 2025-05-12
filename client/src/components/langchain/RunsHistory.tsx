import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, TerminalSquare, Hourglass, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface RunsHistoryProps {
  agentId: number;
}

export function RunsHistory({ agentId }: RunsHistoryProps) {
  // Fetch runs for this agent
  const { data: runs, isLoading } = useQuery({
    queryKey: ['/api/langchain/runs', { agentId }],
    queryFn: getQueryFn({ 
      on401: 'throw',
      queryParams: { agentId }
    }),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Format dates
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy HH:mm:ss');
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-300 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" /> Completed
        </Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-red-300 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> Error
        </Badge>;
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300 flex items-center gap-1">
          <Hourglass className="h-3 w-3" /> Running
        </Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-300 flex items-center gap-1">
          <Clock className="h-3 w-3" /> {status}
        </Badge>;
    }
  };

  // Calculate duration
  const calculateDuration = (startTime: string, endTime?: string) => {
    if (!endTime) return 'In progress';
    
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationMs = end - start;
    
    if (durationMs < 1000) {
      return `${durationMs}ms`;
    } else if (durationMs < 60000) {
      return `${(durationMs / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(durationMs / 60000);
      const seconds = ((durationMs % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="w-full h-8" />
        <Skeleton className="w-full h-20" />
        <Skeleton className="w-full h-20" />
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="pt-6 flex flex-col items-center justify-center p-8 text-center">
          <TerminalSquare className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-medium">No execution runs found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            When you test or use this agent, execution runs will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Recent Execution Runs</h3>
        <Badge variant="outline" className="flex items-center gap-1">
          <Zap className="h-3 w-3" /> {runs.length} runs
        </Badge>
      </div>
      
      <ScrollArea className="h-[400px] rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Time</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px]">Duration</TableHead>
              <TableHead>Input</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run: any) => (
              <TableRow key={run.runId}>
                <TableCell className="font-mono text-xs">
                  {formatDate(run.startTime)}
                </TableCell>
                <TableCell>{getStatusBadge(run.status)}</TableCell>
                <TableCell className="text-xs">
                  {calculateDuration(run.startTime, run.endTime)}
                </TableCell>
                <TableCell className="truncate max-w-[300px]" title={run.input}>
                  {run.input}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}