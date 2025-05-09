import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  WifiOff, 
  Wifi, 
  Globe, 
  Shield, 
  ShieldAlert,
  Info,
  Clock
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function WebSocketDebugger() {
  // Only show in development mode or if in debug mode explicitly
  if (process.env.NODE_ENV === 'production' && !localStorage.getItem('debug-websockets')) {
    return null;
  }
  
  const { isConnected, reconnectCount, reconnect, lastMessage } = useWebSocket();
  const { toast } = useToast();
  const [attempts, setAttempts] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [protocol, setProtocol] = useState('');
  const [wsProtocol, setWsProtocol] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('status');
  const [isReplitEnvironment, setIsReplitEnvironment] = useState(false);
  const [preferredProtocol, setPreferredProtocol] = useState('');
  
  // Track connection attempts, protocols, and last update time
  useEffect(() => {
    setAttempts(reconnectCount);
    setProtocol(window.location.protocol);
    
    // Check if user has manually set a preference
    const userPreferred = localStorage.getItem('websocket-protocol');
    setPreferredProtocol(userPreferred || 'auto');
    
    // Check if we're in Replit environment
    const isReplit = window.location.host.includes('.replit.dev') || 
                    window.location.host.includes('.repl.co');
    setIsReplitEnvironment(isReplit);
    
    // Get actual WebSocket protocol
    const actualProtocol = localStorage.getItem('websocket-protocol') || 
                          (window.location.protocol === 'https:' ? 'wss' : 'ws');
    setWsProtocol(`${actualProtocol}:`);
    
    setLastUpdate(new Date());
  }, [reconnectCount, isConnected, lastMessage]);
  
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

  // Clear protocol override
  const clearProtocolOverride = () => {
    localStorage.removeItem('websocket-protocol');
    toast({
      title: "Protocol Setting Cleared",
      description: "WebSocket will use the default protocol selection logic"
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
      <Card className="fixed bottom-4 right-4 z-50 w-72 shadow-md">
        <CardHeader className="py-2 px-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe size={14} />
            WebSocket Debugger
            {isConnected ? (
              <Badge className="bg-green-500 text-[10px]"><Wifi size={10} className="mr-1" /> Connected</Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px]"><WifiOff size={10} className="mr-1" /> Disconnected</Badge>
            )}
          </CardTitle>
          <Minimize2 
            size={14} 
            className="cursor-pointer text-muted-foreground" 
            onClick={toggleExpanded} 
            aria-label="Minimize"
          />
        </CardHeader>
        
        <Tabs defaultValue="status" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="status" className="pt-2 pb-0 px-3">
            {/* Top warning if the user is using WSS on Replit */}
            {isReplitEnvironment && wsProtocol === 'wss:' && (
              <Alert className="py-2 mb-3 bg-red-100 border border-red-400">
                <AlertCircle size={12} className="mr-1 text-red-600" />
                <AlertDescription className="text-[10px] font-semibold text-red-800">
                  ⚠️ CRITICAL: You're using secure WebSockets (wss://) in Replit which causes connection failures.
                  Click the "Actions" tab and use "Force WS Protocol" button!
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium flex items-center gap-1">
                  <Globe size={12} /> Page Protocol:
                </span>
                <Badge variant="outline">{protocol}</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="font-medium flex items-center gap-1">
                  {wsProtocol === 'wss:' ? <Shield size={12} /> : <ShieldAlert size={12} />} WS Protocol:
                </span>
                <Badge 
                  variant={wsProtocol === 'wss:' ? "secondary" : "outline"}
                  className={wsProtocol === 'wss:' ? 
                    (isReplitEnvironment ? "bg-red-100 text-red-700" : "") : 
                    (isReplitEnvironment ? "bg-green-100 text-green-700" : "text-amber-500")}
                >
                  {wsProtocol}
                </Badge>
              </div>
              
              {isReplitEnvironment && (
                <div className="flex items-center justify-between">
                  <span className="font-medium flex items-center gap-1">
                    <Info size={12} /> Environment:
                  </span>
                  <Badge variant="secondary" className="bg-amber-50 text-amber-800">Replit</Badge>
                </div>
              )}
              
              {preferredProtocol !== 'auto' && (
                <div className="flex items-center justify-between">
                  <span className="font-medium flex items-center gap-1">
                    <Info size={12} /> User Override:
                  </span>
                  <Badge variant="secondary" className="bg-purple-50">
                    {preferredProtocol}
                  </Badge>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="font-medium flex items-center gap-1">
                  <Clock size={12} /> Last Update:
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {lastUpdate.toLocaleTimeString()}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="font-medium flex items-center gap-1">
                  <RefreshCw size={12} /> Reconnect Attempts:
                </span>
                <Badge variant={attempts > 0 ? "destructive" : "outline"}>
                  {attempts}
                </Badge>
              </div>
            </div>
            
            {!isConnected && (
              <Alert variant="destructive">
                <AlertCircle size={12} className="mr-2" />
                <AlertDescription className="text-[10px] font-medium">
                  {isReplitEnvironment ? 
                    "Replit requires non-secure WebSocket (ws://) protocol. Go to Actions tab and click 'Force WS Protocol'." : 
                    "Protocol mismatch detected. Try matching protocols."}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="actions" className="pt-2 pb-0 px-3">
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={handleReconnect}
                className="bg-primary hover:bg-primary/90 text-white px-2 py-1 rounded-sm text-xs flex items-center justify-center"
              >
                <RefreshCw size={12} className="mr-1" /> Manual Reconnect
              </button>
              
              <button 
                onClick={forceMatchProtocol}
                className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-sm text-xs"
              >
                Match Page Protocol ({window.location.protocol === 'https:' ? 'wss://' : 'ws://'})
              </button>
              
              <button 
                onClick={() => {
                  localStorage.setItem('websocket-protocol', 'ws');
                  localStorage.setItem('debug-websockets', 'true');
                  window.location.reload();
                }}
                className="bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded-sm text-xs flex items-center"
              >
                <ShieldAlert size={12} className="mr-1" /> Force WS Protocol (Non-Secure)
              </button>
              
              <button 
                onClick={() => {
                  localStorage.setItem('websocket-protocol', 'wss');
                  localStorage.setItem('debug-websockets', 'true');
                  window.location.reload();
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded-sm text-xs flex items-center"
              >
                <Shield size={12} className="mr-1" /> Force WSS Protocol (Secure)
              </button>
              
              <button 
                onClick={clearProtocolOverride}
                className="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded-sm text-xs"
              >
                Clear Protocol Override
              </button>
            </div>
            
            {isReplitEnvironment && (
              <Alert className="py-2 mt-2 bg-amber-100 mb-2 border border-amber-400">
                <AlertCircle size={12} className="mr-1 text-amber-600" />
                <AlertDescription className="text-[10px] font-medium text-amber-700">
                  IMPORTANT: Replit environments require non-secure WebSocket (ws://) connections.
                  Secure WebSockets (wss://) consistently fail in Replit.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
        
        <CardFooter className="p-2 text-[10px] text-muted-foreground border-t">
          <p>
            {isConnected 
              ? "WebSocket connection active. Receiving live updates."
              : "Connection inactive. Using REST API fallback."}
          </p>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}