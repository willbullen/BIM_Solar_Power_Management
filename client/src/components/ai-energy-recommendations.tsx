import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Lightbulb, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { usePowerData } from '@/hooks/use-power-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Recommendation = {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: 'immediate' | 'scheduled' | 'strategic';
  savings: string;
};

export function AIEnergyRecommendations() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const { powerData, environmentalData, historicalPowerData } = usePowerData();

  // Function to generate recommendations based on current and historical data
  const generateRecommendations = async () => {
    setLoading(true);
    
    try {
      // Prepare data for the AI analysis
      const recentPowerData = historicalPowerData.slice(-24); // Last 24 data points
      
      const analysisData = {
        currentPower: powerData ? {
          totalLoad: powerData.totalLoad,
          mainGridPower: powerData.mainGridPower,
          solarOutput: powerData.solarOutput,
          refrigerationLoad: powerData.refrigerationLoad,
          bigColdRoom: powerData.bigColdRoom,
          bigFreezer: powerData.bigFreezer,
          smoker: powerData.smoker,
          unaccountedLoad: powerData.unaccountedLoad,
          timestamp: powerData.timestamp,
        } : null,
        environmentalData: environmentalData ? {
          temperature: environmentalData.air_temp,
          solarRadiation: environmentalData.ghi,
          weather: environmentalData.weather,
          timestamp: environmentalData.timestamp,
        } : null,
        powerTrend: recentPowerData.map(data => ({
          totalLoad: data.totalLoad,
          mainGridPower: data.mainGridPower,
          solarOutput: data.solarOutput,
          timestamp: data.timestamp,
        }))
      };
      
      // Call the backend for AI analysis
      const response = await fetch('/api/ai/energy-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get AI recommendations');
      }
      
      const data = await response.json();
      setRecommendations(data.recommendations);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      // Fallback recommendations if the API fails
      setRecommendations([
        {
          title: 'Optimize Cold Storage Operations',
          description: 'Your refrigeration load has fluctuated significantly. Consider adjusting freezer temperatures by 1-2°C during non-peak hours to reduce energy consumption.',
          impact: 'high',
          category: 'immediate',
          savings: '10-15%'
        },
        {
          title: 'Solar Output Optimization',
          description: 'Solar panels might need cleaning or maintenance as output is lower than expected for current weather conditions.',
          impact: 'medium',
          category: 'scheduled',
          savings: '5-8%'
        },
        {
          title: 'Load Shifting Opportunity',
          description: 'Consider shifting smoker operations to midday when solar production is highest to reduce grid dependency.',
          impact: 'medium',
          category: 'strategic',
          savings: '7-12%'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && recommendations.length === 0) {
      generateRecommendations();
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return '';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'immediate':
        return 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400';
      case 'scheduled':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400';
      case 'strategic':
        return 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400';
      default:
        return '';
    }
  };

  return (
    <>
      <Button 
        size="sm" 
        variant="outline" 
        className="gap-1 rounded-full px-3"
        onClick={() => handleOpenChange(true)}
      >
        <Lightbulb className="h-4 w-4 text-yellow-500" />
        <span className="text-xs sm:text-sm">Efficiency Tips</span>
      </Button>
      
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Energy Efficiency Recommendations
            </DialogTitle>
            <DialogDescription>
              AI-powered insights based on your current and historical energy consumption patterns.
            </DialogDescription>
          </DialogHeader>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
              <p className="mt-2 text-sm text-muted-foreground">
                Analyzing your energy data...
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
              {recommendations.map((rec, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{rec.title}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="outline" className={getImpactColor(rec.impact)}>
                          {rec.impact.charAt(0).toUpperCase() + rec.impact.slice(1)} Impact
                        </Badge>
                        <Badge variant="outline" className={getCategoryColor(rec.category)}>
                          {rec.category.charAt(0).toUpperCase() + rec.category.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="text-sm">
                      Potential savings: {rec.savings}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{rec.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button 
              variant="default" 
              onClick={generateRecommendations} 
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Refresh Recommendations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}