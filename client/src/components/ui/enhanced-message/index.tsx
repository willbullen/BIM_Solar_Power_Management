import React, { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { ArrowUpRight } from "lucide-react";

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

export interface EnhancedMessageProps {
  content: string;
  role?: 'user' | 'assistant' | 'system';
  timestamp?: string;
}

export function EnhancedMessage({ 
  content,
  role = 'assistant',
  timestamp
}: EnhancedMessageProps) {
  return (
    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-headings:mb-2 prose-headings:mt-4 first:prose-headings:mt-1">
      {content ? (
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
      )}
    </div>
  );
}