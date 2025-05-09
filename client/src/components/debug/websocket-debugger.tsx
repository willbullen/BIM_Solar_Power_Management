import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

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
  
  // Track connection attempts and current protocol
  useEffect(() => {
    setAttempts(reconnectCount);
    setProtocol(window.location.protocol);
  }, [reconnectCount]);
  
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

  if (!expanded) {
    return (
      <div 
        className="fixed bottom-4 right-4 z-50 p-2 bg-background border rounded-md shadow-md cursor-pointer"
        onClick={toggleExpanded}
      >
        <Badge className={isConnected ? "bg-green-500" : "bg-red-500"}>
          WS {isConnected ? "✓" : "✗"}
        </Badge>
      </div>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50 p-3 bg-background border rounded-md shadow-md flex flex-col gap-2 text-xs max-w-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold">WebSocket Debugger</span>
        <X 
          size={14} 
          className="cursor-pointer" 
          onClick={toggleExpanded} 
          aria-label="Minimize"
        />
      </div>
      
      <div className="flex items-center justify-between">
        <span className="font-semibold">Status:</span>
        {isConnected ? (
          <Badge className="bg-green-500">Connected</Badge>
        ) : (
          <Badge variant="destructive">Disconnected</Badge>
        )}
      </div>
      
      <div className="flex items-center justify-between">
        <span className="font-semibold">Protocol:</span>
        <span>{protocol} {protocol === 'https:' ? '(secure)' : '(non-secure)'}</span>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="font-semibold">Host:</span>
        <span className="truncate">{window.location.host}</span>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="font-semibold">Reconnect Attempts:</span>
        <span>{attempts}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-1 mt-1">
        <button 
          onClick={handleReconnect}
          className="bg-primary hover:bg-primary/90 text-white px-2 py-1 rounded-sm text-xs"
        >
          Reconnect
        </button>
        
        <button 
          onClick={() => {
            localStorage.setItem('websocket-protocol', 
              protocol === 'https:' ? 'ws' : 'wss');
            window.location.reload();
          }}
          className="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded-sm text-xs"
        >
          Toggle Protocol
        </button>
      </div>
      
      <div className="mt-1">
        <button 
          onClick={() => {
            // Force use ws:// protocol
            localStorage.setItem('websocket-protocol', 'ws');
            localStorage.setItem('debug-websockets', 'true');
            window.location.reload();
          }}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-sm text-xs"
        >
          Force Reload with WS Protocol
        </button>
      </div>
      
      <div className="text-xs text-gray-500 mt-1">
        {reconnectCount > 0 && <p>Try the "Force Reload" button if connection fails repeatedly</p>}
      </div>
    </div>
  );
}