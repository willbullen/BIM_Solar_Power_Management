import { PowerData, EnvironmentalData } from "@shared/schema";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InsightsCardProps = {
  powerData: PowerData | null;
  environmentalData: EnvironmentalData | null;
  className?: string;
};

export function InsightsCard({ powerData, environmentalData, className }: InsightsCardProps) {
  if (!powerData || !environmentalData) {
    return (
      <div className={cn("bg-card rounded-lg shadow flex items-center justify-center h-full", className)}>
        <p className="text-muted-foreground">No data available for insights</p>
      </div>
    );
  }
  
  // Generate insights based on current data
  const solarEfficiency = (powerData.solarOutput / 5) * 100; // Assuming max output is 5kW
  const solarMessage = getSolarEfficiencyMessage(solarEfficiency, environmentalData.weather);
  
  const refrigerationMessage = getRefrigerationMessage(powerData.refrigerationLoad);
  
  const gridImportCost = powerData.mainGridPower * 0.28 * 24; // €0.28/kWh × 24 hours
  const gridImportMessage = `You're currently importing ${powerData.mainGridPower.toFixed(1)} kW from the grid. Estimated daily cost: €${gridImportCost.toFixed(2)}.`;
  
  const unaccountedPercentage = (powerData.unaccountedLoad / powerData.totalLoad) * 100;
  const unaccountedMessage = `${unaccountedPercentage.toFixed(0)}% of power is unaccounted for. Consider investigating lighting systems and office equipment for efficiency opportunities.`;
  
  return (
    <div className={cn("bg-card rounded-lg shadow", className)}>
      <div className="p-4 border-b border-border flex justify-between items-center">
        <h3 className="text-lg font-medium text-white">Insights & Tips</h3>
        <Button variant="ghost" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4 space-y-4">
        <div className="insights-card solar">
          <h4 className="font-medium text-white text-sm">Solar Output Efficiency</h4>
          <p className="text-sm text-muted-foreground mt-1">{solarMessage}</p>
        </div>
        
        <div className="insights-card refrigeration">
          <h4 className="font-medium text-white text-sm">Refrigeration Load Alert</h4>
          <p className="text-sm text-muted-foreground mt-1">{refrigerationMessage}</p>
        </div>
        
        <div className="insights-card grid">
          <h4 className="font-medium text-white text-sm">Grid Import Costs</h4>
          <p className="text-sm text-muted-foreground mt-1">{gridImportMessage}</p>
        </div>
        
        <div className="insights-card general">
          <h4 className="font-medium text-white text-sm">Unaccounted Power</h4>
          <p className="text-sm text-muted-foreground mt-1">{unaccountedMessage}</p>
        </div>
      </div>
    </div>
  );
}

// Helper functions to generate insight messages
function getSolarEfficiencyMessage(efficiency: number, weather: string): string {
  if (efficiency > 80) {
    return `Your solar system is performing at ${efficiency.toFixed(0)}% efficiency today with ${weather.toLowerCase()} conditions. Solar generation is optimal.`;
  } else if (efficiency > 50) {
    return `Your solar system is performing at ${efficiency.toFixed(0)}% efficiency today due to ${weather.toLowerCase()} conditions. Consider scheduling high-energy tasks during peak solar hours.`;
  } else {
    return `Your solar system is performing at only ${efficiency.toFixed(0)}% efficiency today due to ${weather.toLowerCase()} conditions. Try to minimize non-essential power usage.`;
  }
}

function getRefrigerationMessage(load: number): string {
  if (load > 4.5) {
    return `Cold room power usage is higher than average at ${load.toFixed(1)} kW. Check door seals and verify thermostat settings.`;
  } else if (load > 3.5) {
    return `Cold room power usage is within normal range at ${load.toFixed(1)} kW. Monitor for any changes in efficiency.`;
  } else {
    return `Cold room power usage is below average at ${load.toFixed(1)} kW. System is operating efficiently.`;
  }
}
