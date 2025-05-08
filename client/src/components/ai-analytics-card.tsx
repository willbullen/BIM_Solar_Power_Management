import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, TrendingUp, TrendingDown, MinusCircle, AlertTriangle, PieChart } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAIAnalytics } from "@/hooks/use-ai-analytics";
import { useToast } from "@/hooks/use-toast";

interface AIAnalyticsCardProps {
  historicalPowerData: any[];
  historicalEnvData: any[];
  className?: string;
}

export function AIAnalyticsCard({ historicalPowerData, historicalEnvData, className }: AIAnalyticsCardProps) {
  const [analytics, setAnalytics] = useState<any | null>(null);
  const { generateAnalytics, isLoading } = useAIAnalytics();
  const { toast } = useToast();

  const handleGenerateAnalytics = async () => {
    try {
      const result = await generateAnalytics(historicalPowerData, historicalEnvData);
      setAnalytics(result);
    } catch (error) {
      console.error("Failed to generate analytics:", error);
      toast({
        title: "Analytics Generation Failed",
        description: "There was an error generating the analytics. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Helper to render trend icons
  const renderTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <MinusCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  // Helper to render significance badge
  const renderSignificanceBadge = (significance: string) => {
    let variant = "outline";
    
    switch (significance) {
      case "high":
        variant = "destructive";
        break;
      case "medium":
        variant = "secondary";
        break;
      default:
        variant = "outline";
    }
    
    return (
      <Badge variant={variant as any} className="ml-2">
        {significance}
      </Badge>
    );
  };

  return (
    <Card className={cn("shadow-md", className)}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Brain className="mr-2 h-5 w-5" />
          AI-Powered Analytics
        </CardTitle>
        <CardDescription>
          Advanced data analysis and insights generated using AI
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Analyzing energy data patterns...</p>
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            {/* Summary Section */}
            <div>
              <h3 className="text-lg font-medium">Executive Summary</h3>
              <p className="mt-2 text-muted-foreground">{analytics.summary}</p>
            </div>
            
            <Separator />
            
            {/* Key Insights */}
            <div>
              <h3 className="text-lg font-medium mb-4">Key Insights</h3>
              <Accordion type="single" collapsible className="w-full">
                {analytics.keyInsights?.map((insight: any, index: number) => (
                  <AccordionItem key={index} value={`insight-${index}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center text-left">
                        <span>{insight.title}</span>
                        <div className="ml-auto flex items-center gap-2">
                          {renderTrendIcon(insight.trend)}
                          {renderSignificanceBadge(insight.significance)}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-muted-foreground">{insight.description}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
            
            <Separator />
            
            {/* Patterns */}
            {analytics.patterns && analytics.patterns.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-4">Identified Patterns</h3>
                <div className="space-y-3">
                  {analytics.patterns.map((pattern: any, index: number) => (
                    <div key={index} className="rounded-lg border p-3">
                      <div className="font-medium">{pattern.name}</div>
                      <p className="text-sm text-muted-foreground mt-1">{pattern.description}</p>
                      {pattern.impact && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium">Impact: </span>
                          <span className="text-muted-foreground">{pattern.impact}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Anomalies */}
            {analytics.anomalies && analytics.anomalies.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-4 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                  Anomalies Detected
                </h3>
                <div className="space-y-3">
                  {analytics.anomalies.map((anomaly: any, index: number) => (
                    <div key={index} className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-3">
                      <div className="font-medium">{anomaly.description}</div>
                      
                      {anomaly.possibleCauses && anomaly.possibleCauses.length > 0 && (
                        <div className="mt-2">
                          <span className="text-sm font-medium">Possible Causes:</span>
                          <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                            {anomaly.possibleCauses.map((cause: string, i: number) => (
                              <li key={i}>{cause}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {anomaly.recommendedActions && anomaly.recommendedActions.length > 0 && (
                        <div className="mt-2">
                          <span className="text-sm font-medium">Recommended Actions:</span>
                          <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                            {anomaly.recommendedActions.map((action: string, i: number) => (
                              <li key={i}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Efficiency Score */}
            {analytics.efficiencyScore && (
              <div>
                <h3 className="text-lg font-medium mb-4 flex items-center">
                  <PieChart className="h-4 w-4 mr-2" />
                  Efficiency Score
                </h3>
                
                <div className="grid gap-4 md:grid-cols-4">
                  {/* Overall Score */}
                  <div className="col-span-4 md:col-span-1">
                    <div className="flex flex-col items-center justify-center h-full p-4 rounded-lg border bg-card">
                      <div className="text-3xl font-bold text-primary">
                        {analytics.efficiencyScore.overall}/100
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">Overall Efficiency</p>
                    </div>
                  </div>
                  
                  {/* Component Scores */}
                  <div className="col-span-4 md:col-span-3 grid grid-cols-3 gap-3">
                    {Object.entries(analytics.efficiencyScore.components).map(([key, value]: [string, any], index: number) => (
                      <div key={index} className="flex flex-col items-center justify-center p-3 rounded-lg border">
                        <div className="text-xl font-semibold">
                          {value}/100
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 capitalize">
                          {key}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Explanation */}
                  <div className="col-span-4">
                    <p className="text-sm text-muted-foreground">
                      {analytics.efficiencyScore.explanation}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <Brain className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">AI Analytics Ready</h3>
            <p className="text-muted-foreground mb-6">
              Generate advanced analytics and insights from your power and environmental data to identify patterns, anomalies, and opportunities for optimization.
            </p>
            <Button onClick={handleGenerateAnalytics}>
              Generate Analytics
            </Button>
          </div>
        )}
      </CardContent>
      
      {analytics && (
        <CardFooter>
          <Button variant="outline" onClick={handleGenerateAnalytics} className="ml-auto">
            Refresh Analysis
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}