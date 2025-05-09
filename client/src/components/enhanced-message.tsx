import React, { ReactNode, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bot, User, Clock, Pin, Database, ArrowUpRight, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// Define interfaces used by ReactMarkdown for type safety
interface CodeProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children: ReactNode;
}

interface MarkdownComponentProps {
  node?: any;
  children: ReactNode;
  [key: string]: any;
}

interface EnhancedMessageProps {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string | ReactNode;
  timestamp: string;
  isPinned?: boolean;
  hasReference?: boolean;
  onPin?: () => void;
  onDelete?: () => void;
}

export function EnhancedMessage({ 
  id,
  role, 
  content, 
  timestamp, 
  isPinned = false, 
  hasReference = false,
  onPin,
  onDelete
}: EnhancedMessageProps) {
  // Format the timestamp
  const formattedTime = new Date(timestamp).toLocaleString();
  
  // Get avatar and styling based on message role
  const getAvatarByRole = () => {
    switch (role) {
      case 'user':
        return (
          <Avatar className="h-8 w-8 border border-slate-200/20">
            <AvatarFallback className="bg-slate-700 text-slate-200">U</AvatarFallback>
            <AvatarImage src="/user-avatar.png" alt="User" />
          </Avatar>
        );
      case 'assistant':
        return (
          <Avatar className="h-8 w-8 border border-slate-200/20">
            <AvatarFallback className="bg-blue-700 text-white">AI</AvatarFallback>
            <AvatarImage src="/ai-avatar.png" alt="Assistant" />
          </Avatar>
        );
      case 'system':
        return (
          <Avatar className="h-8 w-8 border border-slate-200/20">
            <AvatarFallback className="bg-slate-800 text-slate-200">S</AvatarFallback>
            <AvatarImage src="/system-avatar.png" alt="System" />
          </Avatar>
        );
    }
  };
  
  // Get background color based on message role
  const getBackgroundColor = () => {
    switch (role) {
      case 'user':
        return 'bg-slate-800 dark:bg-slate-900 border-slate-700';
      case 'assistant':
        return 'bg-blue-900/30 dark:bg-blue-950 border-blue-800/50';
      case 'system':
        return 'bg-slate-900/50 dark:bg-slate-950 border-slate-800/50';
    }
  };

  return (
    <Card className={cn(
      "p-3 relative mb-3 shadow-md border", 
      getBackgroundColor(),
      isPinned && "ring-2 ring-yellow-500/30"
    )}>
      <div className="flex gap-3">
        {getAvatarByRole()}
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-slate-200">
                {role === 'user' ? 'You' : role === 'assistant' ? 'AI Assistant' : 'System'}
              </span>
              
              {/* Display reference badge if the message has a data reference */}
              {hasReference && (
                <Badge variant="outline" className="px-1.5 py-0 text-xs bg-emerald-900/30 text-emerald-300 border-emerald-800/50">
                  <Database className="h-3 w-3 mr-1" />
                  <span>Data Reference</span>
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-1.5">
              {/* Delete button with confirmation dialog - not enabled for system messages */}
              {onDelete && role !== 'system' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button 
                      className="text-slate-400 hover:text-red-400 transition-colors p-1 rounded-full hover:bg-slate-800"
                      title="Delete message"
                      aria-label="Delete message"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-slate-900 border-slate-700">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Delete Message</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-300">
                        Are you sure you want to delete this message? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              
              {/* Pin button/indicator */}
              {isPinned ? (
                <Badge variant="outline" className="px-1.5 py-0 text-xs bg-yellow-900/30 text-yellow-300 border-yellow-800/50">
                  <Pin className="h-3 w-3 mr-1" />
                  <span>Pinned</span>
                </Badge>
              ) : onPin && (
                <button 
                  onClick={onPin}
                  className="text-slate-400 hover:text-yellow-400 transition-colors p-1 rounded-full hover:bg-slate-800"
                  title="Pin message"
                  aria-label="Pin message"
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
              )}
              
              {/* Timestamp */}
              <span className="text-xs text-slate-400 flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {formattedTime}
              </span>
            </div>
          </div>
          
          {/* Enhanced message content with markdown and code highlighting */}
          <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-headings:mb-2 prose-headings:mt-4 first:prose-headings:mt-1">
            {typeof content === 'string' ? (
              content ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  components={{
                    code: ({node, inline, className, children, ...props}: CodeProps) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      )
                    },
                    // Custom styling for other markdown elements
                    a: ({node, ...props}: MarkdownComponentProps) => (
                      <a 
                        {...props} 
                        className="text-blue-400 hover:text-blue-300 hover:underline flex items-center"
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        {props.children}
                        <ArrowUpRight className="h-3 w-3 ml-0.5" />
                      </a>
                    ),
                    table: ({node, ...props}: MarkdownComponentProps) => (
                      <div className="overflow-x-auto my-2">
                        <table className="min-w-full divide-y divide-gray-700 border border-slate-700" {...props} />
                      </div>
                    ),
                    th: ({node, ...props}: MarkdownComponentProps) => (
                      <th 
                        {...props} 
                        className="bg-slate-800 px-3 py-2 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
                      />
                    ),
                    td: ({node, ...props}: MarkdownComponentProps) => (
                      <td 
                        {...props} 
                        className="px-3 py-2 text-sm text-slate-200 border-t border-slate-700"
                      />
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              ) : (
                <div className="text-slate-400 italic">No content</div>
              )
            ) : (
              <div className="markdown-content">
                {content}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}