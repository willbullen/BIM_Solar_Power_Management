import { PowerData } from "@shared/schema";
import { useState, useEffect } from "react";
import { 
  ResponsiveContainer, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid,
  ReferenceLine,
  Area,
  ComposedChart
} from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, subHours, subDays } from "date-fns";
import { Loader2 } from "lucide-react";

type PowerChartProps = {
  data: PowerData[];
  className?: string;
  showProcessLoad?: boolean;
  showLighting?: boolean;
  showHvac?: boolean;
  showRefrigeration?: boolean;
};

export function PowerChart({ data: powerData = [], className, showProcessLoad, showLighting, showHvac, showRefrigeration }: PowerChartProps) {
  const [timeRange, setTimeRange] = useState<string>("1h");
  const [isFiltering, setIsFiltering] = useState(false);
  
  // Calculate date range based on selected timeRange
  const getDateRange = () => {
    const now = new Date();
    switch (timeRange) {
      case "1h":
        return { startDate: subHours(now, 1), endDate: now };
      case "6h":
        return { startDate: subHours(now, 6), endDate: now };
      case "24h":
        return { startDate: subHours(now, 24), endDate: now };
      case "7d":
        return { startDate: subDays(now, 7), endDate: now };
      default:
        return { startDate: subHours(now, 1), endDate: now };
    }
  };
  
  // Safe number handling to prevent NaN values
  const safeNumber = (value: any): number => {
    if (value === undefined || value === null || isNaN(Number(value))) {
      return 0;
    }
    return Number(value);
  };
  
  const { startDate, endDate } = getDateRange();
  
  // Show loading indicator when changing time range
  useEffect(() => {
    setIsFiltering(true);
    // Use a small timeout to simulate loading
    const timer = setTimeout(() => {
      setIsFiltering(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [timeRange]);
  
  // Filter data based on selected time range
  const effectiveData = powerData.filter(item => {
    const timestamp = new Date(item.timestamp);
    return timestamp >= startDate && timestamp <= endDate;
  });
  
  // Transform and sort data for charting
  const chartData = effectiveData
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((data) => ({
      timestamp: new Date(data.timestamp),
      mainGridPower: safeNumber(data.mainGridPower),
      solarOutput: safeNumber(data.solarOutput),
      refrigerationLoad: safeNumber(data.refrigerationLoad),
      totalLoad: safeNumber(data.totalLoad),
      bigFreezer: safeNumber(data.bigFreezer),
      bigColdRoom: safeNumber(data.bigColdRoom),
      smoker: safeNumber(data.smoker)
    }));
  
  // Calculate peak and average values for annotations
  const totalValues = chartData.map((d) => d.totalLoad);
  const peakPower = totalValues.length ? Math.max(...totalValues) : 0;
  const avgPower = totalValues.length 
    ? (totalValues.reduce((sum, val) => sum + val, 0) / totalValues.length) 
    : 0;
  
  const formatXAxis = (timestamp: Date) => {
    if (timeRange === "7d") {
      return format(timestamp, "MM/dd");
    } else if (timeRange === "24h") {
      return format(timestamp, "HH:mm");
    } else {
      return format(timestamp, "HH:mm");
    }
  };
  
  return (
    <div className={cn("chart-container bg-card rounded-lg shadow-md", className)}>
      <div className="p-4 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-medium text-white">Power Usage Timeline</h3>
          <div className="mt-3 md:mt-0 flex flex-wrap gap-2">
            <Button 
              variant={timeRange === "1h" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("1h")}
              disabled={isFiltering}
            >
              1H
            </Button>
            <Button 
              variant={timeRange === "6h" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("6h")}
              disabled={isFiltering}
            >
              6H
            </Button>
            <Button 
              variant={timeRange === "24h" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("24h")}
              disabled={isFiltering}
            >
              24H
            </Button>
            <Button 
              variant={timeRange === "7d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("7d")}
              disabled={isFiltering}
            >
              7D
            </Button>
          </div>
        </div>
      </div>
      <div className="p-4">
        {isFiltering ? (
          <div className="flex items-center justify-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground">Loading {timeRange} data...</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <p>No data available for the selected time range.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
              />
              <YAxis 
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                label={{ 
                  value: 'Power (kW)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  fill: 'rgba(255,255,255,0.6)' 
                }}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(2)} kW`]}
                labelFormatter={(label: Date) => format(label, "yyyy-MM-dd HH:mm:ss")}
                contentStyle={{
                  backgroundColor: '#35434a',
                  border: '1px solid #44555e',
                  color: 'rgba(255,255,255,0.9)',
                  borderRadius: "4px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)"
                }}
                itemStyle={{ color: 'rgba(255,255,255,0.9)' }}
                labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
              />
              <Legend 
                iconType="circle"
                wrapperStyle={{
                  paddingTop: "10px",
                }}
              />
              
              {/* Area for total load */}
              <Area 
                type="monotone"
                dataKey="totalLoad"
                fill="rgba(255, 159, 12, 0.2)"
                stroke="rgba(255, 159, 12, 0.8)"
                name="Total Load"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 1 }}
              />
              
              {/* Reference lines for peak and average */}
              <ReferenceLine 
                y={peakPower} 
                stroke="rgba(255, 107, 107, 0.7)" 
                strokeDasharray="5 5"
                label={{ 
                  value: `Peak: ${peakPower.toFixed(2)} kW`, 
                  position: 'insideTopRight',
                  fill: "rgba(255, 107, 107, 0.9)",
                  fontSize: 12
                }}
              />
              
              <ReferenceLine 
                y={avgPower} 
                stroke="rgba(255, 230, 109, 0.7)" 
                strokeDasharray="5 5"
                label={{ 
                  value: `Avg: ${avgPower.toFixed(2)} kW`, 
                  position: 'insideBottomRight',
                  fill: "rgba(255, 230, 109, 0.9)",
                  fontSize: 12
                }}
              />
              
              {/* Main power metrics */}
              <Line 
                type="monotone" 
                dataKey="mainGridPower" 
                name="Main Grid" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="solarOutput" 
                name="Solar Output" 
                stroke="hsl(var(--accent))" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="refrigerationLoad" 
                name="Refrigeration" 
                stroke="hsl(var(--chart-3))" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              
              {/* Equipment-specific lines (displayed selectively) */}
              {timeRange !== "7d" && (
                <>
                  <Line 
                    type="monotone" 
                    dataKey="bigFreezer" 
                    stroke="#C77DFF" 
                    strokeWidth={1.5}
                    name="Big Freezer" 
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="bigColdRoom" 
                    stroke="#5390D9" 
                    strokeWidth={1.5}
                    name="Cold Room" 
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="smoker" 
                    stroke="#F15BB5" 
                    strokeWidth={1.5}
                    name="Smoker" 
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}