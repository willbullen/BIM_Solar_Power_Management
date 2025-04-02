import { PowerData } from "@shared/schema";
import { cn } from "@/lib/utils";

type MetricsCardProps = {
  title: string;
  value: number;
  unit: string;
  status: string;
  statusColor: string;
  icon: React.ReactNode;
  extraInfo1: string;
  extraInfo2: string;
  percentFill: number;
  className?: string;
};

export function MetricsCard({
  title,
  value,
  unit,
  status,
  statusColor,
  icon,
  extraInfo1,
  extraInfo2,
  percentFill,
  className
}: MetricsCardProps) {
  return (
    <div className={cn("metric-card", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <h2 className="metric-value text-white mt-1">
            {value.toFixed(1)} {unit}
          </h2>
          <p className="text-sm">
            <span className={`text-${statusColor}`}>{status}</span>
          </p>
        </div>
        <div className="p-2 rounded-md bg-muted">
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{extraInfo1}</span>
          <span>{extraInfo2}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full bg-${statusColor}`} 
            style={{ width: `${Math.min(100, percentFill)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

type SummaryCardsProps = {
  powerData: PowerData | null;
};

export function SummaryCards({ powerData }: SummaryCardsProps) {
  if (!powerData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-lg p-4 shadow h-32 animate-pulse">
            <div className="h-full flex items-center justify-center">
              <p className="text-muted-foreground">Loading data...</p>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  // Calculate daily values (current power × 24 hours)
  const mainGridDaily = powerData.mainGridPower * 24;
  const solarEfficiency = (powerData.solarOutput / 5) * 100; // Assuming max output is 5kW
  const refrigerationDaily = powerData.refrigerationLoad * 24;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Main Grid Supply */}
      <MetricsCard
        title="Main Grid"
        value={powerData.mainGridPower}
        unit="kW"
        status="Importing from grid"
        statusColor="destructive"
        icon={<i className="bi bi-plug-fill text-xl text-primary"></i>}
        extraInfo1={`Daily: ${mainGridDaily.toFixed(2)} kWh`}
        extraInfo2={`${(powerData.mainGridPower * 1000).toFixed(0)} Watts`}
        percentFill={(powerData.mainGridPower / 10) * 100}
      />
      
      {/* Solar PV Output */}
      <MetricsCard
        title="Solar PV"
        value={powerData.solarOutput}
        unit="kW"
        status="Generating power"
        statusColor="accent"
        icon={<i className="bi bi-sun-fill text-xl text-[#ff9f0c]"></i>}
        extraInfo1={`Efficiency: ${solarEfficiency.toFixed(0)}%`}
        extraInfo2={`Peak: 5.0 kW`}
        percentFill={(powerData.solarOutput / 5) * 100}
      />
      
      {/* Refrigeration Load */}
      <MetricsCard
        title="Refrigeration"
        value={powerData.refrigerationLoad}
        unit="kW"
        status="Major consumer"
        statusColor="warning"
        icon={<i className="bi bi-thermometer-snow text-xl text-primary"></i>}
        extraInfo1={`Daily: ${refrigerationDaily.toFixed(2)} kWh`}
        extraInfo2={`${(powerData.refrigerationLoad * 1000).toFixed(0)} Watts`}
        percentFill={(powerData.refrigerationLoad / 6) * 100}
      />
      
      {/* Unaccounted Consumption */}
      <MetricsCard
        title="Unaccounted"
        value={powerData.unaccountedLoad}
        unit="kW"
        status="Other consumption"
        statusColor="secondary"
        icon={<i className="bi bi-question-circle-fill text-xl text-secondary"></i>}
        extraInfo1={`Percent: ${((powerData.unaccountedLoad / powerData.totalLoad) * 100).toFixed(0)}%`}
        extraInfo2={`Daily: ${(powerData.unaccountedLoad * 24).toFixed(2)} kWh`}
        percentFill={(powerData.unaccountedLoad / powerData.totalLoad) * 100}
      />
    </div>
  );
}
