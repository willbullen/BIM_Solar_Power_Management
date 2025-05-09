import React from 'react';
import { usePowerData } from '@/hooks/use-power-data';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export function ConnectionStatus() {
  const { connectionType, isConnected, dataStatus, lastUpdated } = usePowerData();

  // Format the last updated time
  const formattedTime = lastUpdated 
    ? new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
      }).format(lastUpdated)
    : 'Never';

  // Define badge variant and icon based on connection status
  let badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
  let icon = <RefreshCw className="h-4 w-4 mr-1 animate-spin" />;
  let statusText = 'Connecting...';
  
  if (isConnected) {
    if (connectionType === 'websocket') {
      badgeVariant = 'default'; // Green for WebSocket (real-time)
      icon = <Wifi className="h-4 w-4 mr-1" />;
      statusText = 'Real-time';
    } else {
      badgeVariant = 'secondary'; // Gray for polling
      icon = <RefreshCw className="h-4 w-4 mr-1" />;
      statusText = 'Polling';
    }
  } else {
    badgeVariant = 'destructive'; // Red for disconnected
    icon = <WifiOff className="h-4 w-4 mr-1" />;
    statusText = 'Disconnected';
  }

  // Add additional info about the data source (live/synthetic)
  const sourceInfo = dataStatus !== 'offline' 
    ? `${dataStatus === 'synthetic' ? 'Synthetic' : 'Live'} Data` 
    : 'No Data';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={badgeVariant} className="flex items-center gap-1 cursor-help">
            {icon}
            {statusText}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <p><strong>Connection:</strong> {connectionType}</p>
            <p><strong>Status:</strong> {isConnected ? 'Connected' : 'Disconnected'}</p>
            <p><strong>Data source:</strong> {sourceInfo}</p>
            <p><strong>Last update:</strong> {formattedTime}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}