import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, X, ArrowDown, ArrowUp } from "lucide-react";

interface MessageSearchProps {
  messages: Array<{ id: number; content: string; role: string; createdAt: string }>;
  onSelectResult: (messageId: number) => void;
}

export function MessageSearch({ messages, onSelectResult }: MessageSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: number;
    content: string;
    role: string;
    createdAt: string;
    previewText: string;
    matchCount: number;
  }>>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);

  // Perform search when search term changes
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      setSelectedResultIndex(-1);
      return;
    }

    const results = messages.filter(message => 
      message.content.toLowerCase().includes(searchTerm.toLowerCase())
    ).map(message => {
      // Create a preview with the matched text highlighted
      const lowerContent = message.content.toLowerCase();
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchCount = (lowerContent.match(new RegExp(lowerSearchTerm, 'g')) || []).length;
      
      // Extract text around the match for preview
      const matchIndex = lowerContent.indexOf(lowerSearchTerm);
      const startPreview = Math.max(0, matchIndex - 40);
      const endPreview = Math.min(message.content.length, matchIndex + searchTerm.length + 40);
      
      let previewText = message.content.substring(startPreview, endPreview);
      if (startPreview > 0) previewText = '...' + previewText;
      if (endPreview < message.content.length) previewText = previewText + '...';
      
      return {
        ...message,
        previewText,
        matchCount
      };
    });
    
    setSearchResults(results);
    setSelectedResultIndex(results.length > 0 ? 0 : -1);
  }, [searchTerm, messages]);

  // Handle navigating to next/previous result
  const navigateResult = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    
    if (direction === 'next') {
      const nextIndex = (selectedResultIndex + 1) % searchResults.length;
      setSelectedResultIndex(nextIndex);
      onSelectResult(searchResults[nextIndex].id);
    } else {
      const prevIndex = selectedResultIndex <= 0 ? searchResults.length - 1 : selectedResultIndex - 1;
      setSelectedResultIndex(prevIndex);
      onSelectResult(searchResults[prevIndex].id);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setSelectedResultIndex(-1);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <Input
          type="text"
          placeholder="Search messages..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-24 bg-slate-800 border-slate-700 text-white"
        />
        {searchTerm && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
            <Badge variant="outline" className="bg-blue-900/30 text-blue-300 border-blue-800">
              {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
            </Badge>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => navigateResult('prev')}
              disabled={searchResults.length === 0}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6" 
              onClick={() => navigateResult('next')}
              disabled={searchResults.length === 0}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6" 
              onClick={clearSearch}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      
      {searchResults.length > 0 && (
        <ScrollArea className="mt-2 border border-slate-700 rounded-md bg-slate-900/50 max-h-40">
          <div className="p-2 space-y-1">
            {searchResults.map((result, index) => (
              <div 
                key={result.id}
                className={`p-2 rounded text-xs cursor-pointer hover:bg-slate-800 ${
                  index === selectedResultIndex ? 'bg-blue-900/30 border border-blue-800/50' : 'border border-transparent'
                }`}
                onClick={() => {
                  setSelectedResultIndex(index);
                  onSelectResult(result.id);
                }}
              >
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-slate-300">
                    {result.role === 'user' ? 'You' : 'AI Assistant'}
                  </span>
                  <span className="text-slate-400">
                    {new Date(result.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-200 line-clamp-2">
                  {result.previewText.split(new RegExp(`(${searchTerm})`, 'gi')).map((part, i) => 
                    part.toLowerCase() === searchTerm.toLowerCase() 
                      ? <mark key={i} className="bg-yellow-600/50 text-yellow-100 rounded px-1">{part}</mark> 
                      : part
                  )}
                </p>
                <div className="text-right mt-1">
                  <Badge variant="outline" className="bg-slate-800/50 text-slate-300 border-slate-700 text-[10px]">
                    {result.matchCount} {result.matchCount === 1 ? 'match' : 'matches'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}