import React, { useState } from 'react';
import { format } from 'date-fns';
import { 
  Calendar, 
  Clock, 
  Zap, 
  ChevronRight, 
  ChevronDown, 
  Award, 
  AlertTriangle,
  Leaf,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useSchedulingAdvisor, SchedulingRecommendation } from '@/hooks/use-scheduling-advisor';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

interface SchedulingAdvisorProps {
  className?: string;
}

export function SchedulingAdvisor({ className }: SchedulingAdvisorProps) {
  const { 
    recommendations, 
    isLoading, 
    isFallback,
    horizon,
    setHorizon
  } = useSchedulingAdvisor();
  
  const [expandedRecommendation, setExpandedRecommendation] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Get unique equipment names for filter
  const equipmentNames = Array.from(new Set(recommendations?.map(rec => rec.equipmentName) || []));
  
  // Get unique recommendation types for filter
  const recommendationTypes = Array.from(new Set(recommendations?.map(rec => rec.recommendationType) || []));
  
  // Filter recommendations based on selected filters
  const filteredRecommendations = recommendations?.filter(rec => {
    const matchesEquipment = equipmentFilter === 'all' || rec.equipmentName === equipmentFilter;
    const matchesType = typeFilter === 'all' || rec.recommendationType === typeFilter;
    return matchesEquipment && matchesType;
  });
  
  // Toggle expanded state for a recommendation
  const toggleExpanded = (id: string) => {
    setExpandedRecommendation(prev => prev === id ? null : id);
  };
  
  // Helper to get icon for recommendation type
  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'optimal':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'postpone':
        return <ArrowDownRight className="h-5 w-5 text-amber-500" />;
      case 'advance':
        return <ArrowUpRight className="h-5 w-5 text-blue-500" />;
      case 'avoid':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Zap className="h-5 w-5 text-primary" />;
    }
  };
  
  // Helper to get badge color based on recommendation type
  const getRecommendationBadgeStyle = (type: string) => {
    switch (type) {
      case 'optimal':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'postpone':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'advance':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'avoid':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return '';
    }
  };
  
  // Helper to format recommendation type for display
  const formatRecommendationType = (type: string) => {
    switch (type) {
      case 'optimal':
        return 'Optimal Operation';
      case 'postpone':
        return 'Postpone Operation';
      case 'advance':
        return 'Advance Operation';
      case 'avoid':
        return 'Avoid Operation';
      default:
        return type;
    }
  };
  
  // Render confidence indicator
  const renderConfidence = (confidence: 'high' | 'medium' | 'low') => {
    let color = '';
    let width = '';
    
    switch (confidence) {
      case 'high':
        color = 'bg-green-500';
        width = 'w-full';
        break;
      case 'medium':
        color = 'bg-amber-500';
        width = 'w-2/3';
        break;
      case 'low':
        color = 'bg-red-500';
        width = 'w-1/3';
        break;
    }
    
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${color} ${width}`} />
        </div>
        <span className="text-xs font-medium capitalize">{confidence}</span>
      </div>
    );
  };
  
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center">
              <Zap className="h-5 w-5 mr-2 text-primary" />
              Dynamic Operational Scheduling Advisor
              {isFallback && (
                <Badge variant="outline" className="ml-2 bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                  Using Forecast Data
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              AI-powered recommendations for optimal equipment operation scheduling based on solar forecast
            </CardDescription>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Forecast horizon:</span>
            <Select 
              value={horizon.toString()}
              onValueChange={(value) => setHorizon?.(parseInt(value))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Horizon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 Hours</SelectItem>
                <SelectItem value="48">48 Hours</SelectItem>
                <SelectItem value="72">3 Days</SelectItem>
                <SelectItem value="168">7 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : recommendations?.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">No Scheduling Recommendations</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              We don't have any scheduling recommendations based on the current forecast.
              Try increasing the forecast horizon or check back later.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 mb-4">
              <Select 
                value={equipmentFilter}
                onValueChange={setEquipmentFilter}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Equipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Equipment</SelectItem>
                  {equipmentNames.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select 
                value={typeFilter}
                onValueChange={setTypeFilter}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {recommendationTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {formatRecommendationType(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3">
              {filteredRecommendations?.map((recommendation) => (
                <div 
                  key={recommendation.id}
                  className="border rounded-lg overflow-hidden transition-all"
                >
                  <div 
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpanded(recommendation.id)}
                  >
                    <div className="flex items-center gap-3">
                      {getRecommendationIcon(recommendation.recommendationType)}
                      <div>
                        <h3 className="font-medium text-sm">
                          {recommendation.equipmentName}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {format(recommendation.timeWindow.start, 'MMM d, HH:mm')} - {format(recommendation.timeWindow.end, 'HH:mm')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="outline" 
                        className={getRecommendationBadgeStyle(recommendation.recommendationType)}
                      >
                        {formatRecommendationType(recommendation.recommendationType)}
                      </Badge>
                      
                      <div className="flex items-center gap-1 text-green-500">
                        <Leaf className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">€{recommendation.potentialSavings.toFixed(2)}</span>
                      </div>
                      
                      {expandedRecommendation === recommendation.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  
                  {expandedRecommendation === recommendation.id && (
                    <div className="p-4 border-t bg-muted/20">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Recommendation Details</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Time Window:</span>
                              <span>{format(recommendation.timeWindow.start, 'MMM d, HH:mm')} - {format(recommendation.timeWindow.end, 'HH:mm')}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm">
                              <Zap className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Solar Output:</span>
                              <span>{recommendation.solarForecast.toFixed(1)} kW</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm">
                              <Leaf className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Potential Savings:</span>
                              <span className="text-green-500 font-medium">€{recommendation.potentialSavings.toFixed(2)}</span>
                            </div>
                            
                            <div className="flex flex-col gap-1 text-sm">
                              <div className="flex items-center gap-2">
                                <Award className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Confidence:</span>
                              </div>
                              {renderConfidence(recommendation.confidence)}
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium mb-2">Rationale</h4>
                          <p className="text-sm">{recommendation.reason}</p>
                          
                          <div className="mt-4">
                            <h4 className="text-sm font-medium mb-2">Actions</h4>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" className="text-xs">
                                <Calendar className="h-3.5 w-3.5 mr-1" />
                                Schedule
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs">
                                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                                Ignore
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
          
        <div className="mt-4 p-3 bg-muted/30 rounded-lg">
          <h4 className="text-sm font-medium mb-2">How It Works</h4>
          <p className="text-xs text-muted-foreground">
            The scheduling advisor analyzes solar forecast data and equipment needs to suggest optimal 
            operational times. It prioritizes high solar production periods to reduce grid electricity usage 
            and evaluates each equipment's flexibility for scheduling.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}