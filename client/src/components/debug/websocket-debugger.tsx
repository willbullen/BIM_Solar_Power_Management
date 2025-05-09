import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Maximize2, Minimize2, RefreshCw, WifiOff, Wifi } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function WebSocketDebugger() {
  // Only show in development mode or if in debug mode explicitly
  if (process.env.NODE_ENV === 'production' && !localStorage.getItem('debug-websockets')) {
    return null;
  }
  
  const { isConnected, reconnectCount, reconnect } = useWebSocket();
  const { toast } = useToast();
  const [attempts, setAttempts] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [protocol, setProtocol] = useState('');
  const [wsProtocol, setWsProtocol] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  // Track connection attempts, protocols, and last update time
  useEffect(() => {
    setAttempts(reconnectCount);
    setProtocol(window.location.protocol);
    setWsProtocol(window.location.protocol === 'https:' ? 'wss:' : 'ws:');
    setLastUpdate(new Date());
  }, [reconnectCount, isConnected]);
  
  // Manual reconnect handler
  const handleReconnect = () => {
    toast({
      title: "Reconnecting WebSocket",
      description: "Manually triggering WebSocket reconnection..."
    });
    reconnect();
  };
  
  // Toggle expanded state
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Force match protocol to page
  const forceMatchProtocol = () => {
    const targetProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    localStorage.setItem('websocket-protocol', targetProtocol);
    localStorage.setItem('debug-websockets', 'true');
    toast({
      title: "Protocol Changed",
      description: `Changing WebSocket protocol to ${targetProtocol}://`
    });
    window.location.reload();
  };

  // If minimized, show just the connection status indicator
  if (!expanded) {
    return (
      <div 
        className="fixed bottom-4 right-4 z-50 p-2 bg-background border rounded-md shadow-md cursor-pointer flex items-center gap-2"
        onClick={toggleExpanded}
      >
        <Badge className={isConnected ? "bg-green-500" : "bg-red-500"}>
          {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
        </Badge>
        <Maximize2 size={14} className="text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <TooltipProvider>
      <div className="fixed bottom-4 right-4 z-50 p-3 bg-background border rounded-md shadow-md flex flex-col gap-2 text-xs max-w-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">WebSocket Debugger</span>
            {isConnected ? (
              <Badge className="bg-green-500"><Wifi size={10} className="mr-1" /> Connected</Badge>
            ) : (
              <Badge variant="destructive"><WifiOff size={10} className="mr-1" /> Disconnected</Badge>
            )}
          </div>
          <Minimize2 
            size={14} 
            className="cursor-pointer text-muted-foreground" 
            onClick={toggleExpanded} 
            aria-label="Minimize"
          />
        </div>
        
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium">Page Protocol:</span>
            <span>{protocol}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="font-medium">WebSocket Protocol:</span>
            <span>{wsProtocol}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="font-medium">Host:</span>
            <span className="truncate">{window.location.host}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="font-medium">Reconnect Attempts:</span>
            <span>{attempts}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium">Last Update:</span>
            <span className="truncate">{lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>
        
        {!isConnected && attempts > 2 && (
          <Alert className="py-2 mt-1 bg-amber-50">
            <AlertDescription className="text-[10px]">
              Security restrictions may be preventing WebSocket connections. Try the "Match Page Protocol" button.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-2 gap-1 mt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={handleReconnect}
                className="bg-primary hover:bg-primary/90 text-white px-2 py-1 rounded-sm text-xs flex items-center justify-center"
              >
                <RefreshCw size={12} className="mr-1" /> Reconnect
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Manually reconnect WebSocket</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={forceMatchProtocol}
                className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-sm text-xs"
              >
                Match Page Protocol
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Use {window.location.protocol === 'https:' ? 'wss://' : 'ws://'} protocol for WebSocket</p>
            </TooltipContent>
          </Tooltip>
        </div>
        
        <div className="grid grid-cols-2 gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => {
                  localStorage.setItem('websocket-protocol', 'ws');
                  localStorage.setItem('debug-websockets', 'true');
                  window.location.reload();
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded-sm text-xs"
              >
                Force WS Protocol
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Force use non-secure ws:// protocol</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => {
                  localStorage.setItem('websocket-protocol', 'wss');
                  localStorage.setItem('debug-websockets', 'true');
                  window.location.reload();
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded-sm text-xs"
              >
                Force WSS Protocol
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Force use secure wss:// protocol</p>
            </TooltipContent>
          </Tooltip>
        </div>
        
        {reconnectCount > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            <p>Browser security requires protocol matching between page and WebSocket connection</p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}