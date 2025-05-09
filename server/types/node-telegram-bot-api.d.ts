declare module 'node-telegram-bot-api' {
  export interface Message {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      type: 'private' | 'group' | 'supergroup' | 'channel';
      title?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    date: number;
    text?: string;
    entities?: {
      type: string;
      offset: number;
      length: number;
    }[];
    reply_to_message?: Message;
    // Add other message properties as needed
  }

  export interface SendMessageOptions {
    parse_mode?: 'Markdown' | 'HTML';
    disable_web_page_preview?: boolean;
    disable_notification?: boolean;
    reply_to_message_id?: number;
    reply_markup?: any;
  }

  export default class TelegramBot {
    constructor(token: string, options?: { polling?: boolean | { interval?: number, params?: any } });
    
    on(event: 'message' | 'callback_query' | 'inline_query' | string, listener: (message: any, ...args: any[]) => void): this;
    onText(regexp: RegExp, callback: (msg: Message, match: RegExpExecArray | null) => void): void;
    
    sendMessage(chatId: number | string, text: string, options?: SendMessageOptions): Promise<Message>;
    getMe(): Promise<any>;
    
    // Add other methods as needed
    setWebHook(url: string, options?: any): Promise<boolean>;
    getWebHookInfo(): Promise<any>;
    deleteWebHook(): Promise<boolean>;
    
    stopPolling(): Promise<void>;
  }
}