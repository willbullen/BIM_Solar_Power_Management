import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export function WebSocketDebugger() {
  // Only show in development mode
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  
  const { isConnected, reconnectCount, reconnect } = useWebSocket();
  const { toast } = useToast();
  const [attempts, setAttempts] = useState(0);
  
  // Track connection attempts
  useEffect(() => {
    setAttempts(reconnectCount);
  }, [reconnectCount]);
  
  // Manual reconnect handler
  const handleReconnect = () => {
    toast({
      title: "Reconnecting WebSocket",
      description: "Manually triggering WebSocket reconnection..."
    });
    reconnect();
  };
  
  return (
    <div className="fixed bottom-4 right-4 z-50 p-3 bg-background border rounded-md shadow-md flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold">WebSocket Status:</span>
        {isConnected ? (
          <Badge className="bg-green-500">Connected</Badge>
        ) : (
          <Badge variant="destructive">Disconnected</Badge>
        )}
      </div>
      
      <div className="flex items-center">
        <span className="font-semibold mr-2">Reconnect Attempts:</span>
        <span>{attempts}</span>
      </div>
      
      <button 
        onClick={handleReconnect}
        className="bg-primary hover:bg-primary/90 text-white px-2 py-1 rounded-sm text-xs"
      >
        Reconnect
      </button>
    </div>
  );
}