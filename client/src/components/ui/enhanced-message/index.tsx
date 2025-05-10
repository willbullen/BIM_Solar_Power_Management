import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { ArrowUpRight } from "lucide-react";

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
      {content && content.trim() ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize]}
          components={{
            code: (props) => {
              const {className, children, ...rest} = props;
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match;
              
              return !isInline ? (
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match ? match[1] : ''}
                  PreTag="div"
                  {...rest}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...rest}>
                  {children}
                </code>
              );
            },
            a: (props) => {
              const {children, ...rest} = props;
              return (
                <a 
                  {...rest} 
                  className="text-blue-400 hover:text-blue-300 hover:underline flex items-center"
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  {children}
                  <ArrowUpRight className="h-3 w-3 ml-0.5" />
                </a>
              );
            },
            table: (props) => {
              const {children, ...rest} = props;
              return (
                <div className="overflow-x-auto my-2">
                  <table className="min-w-full divide-y divide-gray-700 border border-slate-700" {...rest}>
                    {children}
                  </table>
                </div>
              );
            },
            th: (props) => {
              const {children, ...rest} = props;
              return (
                <th 
                  {...rest} 
                  className="bg-slate-800 px-3 py-2 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
                >
                  {children}
                </th>
              );
            },
            td: (props) => {
              const {children, ...rest} = props;
              return (
                <td 
                  {...rest} 
                  className="px-3 py-2 text-sm text-slate-200 border-t border-slate-700"
                >
                  {children}
                </td>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      ) : null}
    </div>
  );
}