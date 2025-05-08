import React from "react";
import { useSchedulingAdvisor } from "@/hooks/use-scheduling-advisor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import {
  Clock,
  AlertTriangle,
  Check,
  RefreshCw,
  Zap,
  FastForward,
  Hourglass,
  Ban,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SchedulingAdvisor() {
  const {
    recommendations,
    isLoading,
    isFallback,
    horizon,
    setHorizon,
  } = useSchedulingAdvisor();

  // Handle horizon selection
  const handleHorizonChange = (value: string) => {
    setHorizon(parseInt(value, 10));
  };

  // Get the icon for recommendation type
  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'optimal':
        return <Zap className="h-4 w-4 text-green-500" />;
      case 'postpone':
        return <Hourglass className="h-4 w-4 text-amber-500" />;
      case 'advance':
        return <FastForward className="h-4 w-4 text-blue-500" />;
      case 'avoid':
        return <Ban className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // Get the badge variant for recommendation type
  const getRecommendationBadge = (type: string) => {
    switch (type) {
      case 'optimal':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            Optimal Time
          </Badge>
        );
      case 'postpone':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
            Postpone
          </Badge>
        );
      case 'advance':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            Advance
          </Badge>
        );
      case 'avoid':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
            Avoid
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Get the badge for confidence level
  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            High
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
            Medium
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
            Low
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Format currency for potential savings
  const formatCurrency = (value: number) => {
    return `€${value.toFixed(2)}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Scheduling Advisor</CardTitle>
            <CardDescription>
              Optimize equipment operation based on solar forecast
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Forecast horizon:</span>
              <Select
                value={horizon.toString()}
                onValueChange={handleHorizonChange}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="72 hours" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 Hours</SelectItem>
                  <SelectItem value="48">48 Hours</SelectItem>
                  <SelectItem value="72">3 Days</SelectItem>
                  <SelectItem value="168">7 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" className="gap-1">
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isFallback && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Using estimated data</AlertTitle>
            <AlertDescription>
              Unable to fetch real-time forecast data from Solcast API. Recommendations are based on estimated data.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Check className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No recommendations needed</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Current equipment schedules appear to be optimized for the forecasted solar production.
              Check back later as weather conditions and energy production change.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Recommendation</TableHead>
                  <TableHead>Time Window</TableHead>
                  <TableHead>Saving Potential</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recommendations.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="font-medium">
                      {rec.equipmentName}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRecommendationIcon(rec.recommendationType)}
                        {getRecommendationBadge(rec.recommendationType)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {format(rec.timeWindow.start, "MMM d, HH:mm")}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          to {format(rec.timeWindow.end, "MMM d, HH:mm")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-green-500">
                      {formatCurrency(rec.potentialSavings)}
                    </TableCell>
                    <TableCell>{getConfidenceBadge(rec.confidence)}</TableCell>
                    <TableCell className="max-w-xs">
                      <span className="text-sm line-clamp-2">{rec.reason}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}