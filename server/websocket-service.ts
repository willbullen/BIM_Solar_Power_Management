import { WebSocket } from 'ws';

// Define a class to manage WebSocket subscriptions and broadcasts
export class WebSocketService {
  private static instance: WebSocketService;
  private subscriptions: Map<string, Set<WebSocket>>;
  
  private constructor() {
    this.subscriptions = new Map<string, Set<WebSocket>>();
    
    // Initialize default subscription channels
    this.subscriptions.set('power-data', new Set<WebSocket>());
    this.subscriptions.set('environmental-data', new Set<WebSocket>());
    this.subscriptions.set('agent-notifications', new Set<WebSocket>());
    this.subscriptions.set('agent-messages', new Set<WebSocket>());
  }
  
  // Singleton pattern to ensure one instance across the application
  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }
  
  // Get valid subscription channels
  public getValidChannels(): string[] {
    return Array.from(this.subscriptions.keys());
  }
  
  // Add a subscription for a client
  public addSubscription(channel: string, client: WebSocket): boolean {
    const subscribers = this.subscriptions.get(channel);
    if (subscribers) {
      subscribers.add(client);
      console.log(`Client subscribed to ${channel}, total subscribers: ${subscribers.size}`);
      return true;
    }
    return false;
  }
  
  // Remove a subscription for a client
  public removeSubscription(channel: string, client: WebSocket): boolean {
    const subscribers = this.subscriptions.get(channel);
    if (subscribers) {
      const removed = subscribers.delete(client);
      if (removed) {
        console.log(`Client unsubscribed from ${channel}, remaining subscribers: ${subscribers.size}`);
      }
      return removed;
    }
    return false;
  }
  
  // Broadcast data to all subscribed clients on a specific channel
  public broadcast(channelName: string, data: any): void {
    const subscribers = this.subscriptions.get(channelName);
    
    if (subscribers && subscribers.size > 0) {
      // Prepare the message
      const message = JSON.stringify({
        type: channelName,
        data: data
      });
      
      // Send to all subscribed clients
      let activeClients = 0;
      let failedClients = 0;
      
      subscribers.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(message);
            activeClients++;
          } catch (error) {
            console.error(`Error broadcasting to client: ${error}`);
            failedClients++;
          }
        }
      });
      
      console.log(`Broadcast ${channelName} to ${activeClients} clients (${failedClients} failed)`);
    } else {
      console.log(`No subscribers for ${channelName}, broadcast skipped`);
    }
  }
  
  // Remove a client from all subscriptions
  public removeClient(client: WebSocket): void {
    this.subscriptions.forEach((subscribers, channel) => {
      if (subscribers.has(client)) {
        subscribers.delete(client);
        console.log(`Client removed from ${channel}, remaining subscribers: ${subscribers.size}`);
      }
    });
  }
  
  // Broadcast an agent notification to all subscribed clients
  public broadcastAgentNotification(notification: any): void {
    const formattedPayload = {
      type: 'agent-notification',
      payload: notification,
      timestamp: new Date().toISOString()
    };
    this.broadcast('agent-notifications', formattedPayload);
  }
  
  // Broadcast an agent message to all subscribed clients
  public broadcastAgentMessage(message: any): void {
    const formattedPayload = {
      type: 'agent-message',
      payload: message,
      timestamp: new Date().toISOString()
    };
    this.broadcast('agent-messages', formattedPayload);
  }
}

// Export a singleton instance
export const webSocketService = WebSocketService.getInstance();