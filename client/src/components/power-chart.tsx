import { PowerData } from "@shared/schema";
import { useState } from "react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid
} from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type PowerChartProps = {
  powerData: PowerData[];
  className?: string;
};

export function PowerChart({ powerData, className }: PowerChartProps) {
  const [timeRange, setTimeRange] = useState<string>("1h");
  
  // Filter data based on selected time range
  const filteredData = powerData
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .filter(data => {
      const timestamp = new Date(data.timestamp);
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      switch (timeRange) {
        case "1h":
          return timestamp >= hourAgo;
        case "6h":
          return timestamp >= sixHoursAgo;
        case "24h":
          return timestamp >= dayAgo;
        case "7d":
          return timestamp >= weekAgo;
        default:
          return true;
      }
    });
  
  // Transform data for charting
  const chartData = filteredData.map(data => ({
    timestamp: new Date(data.timestamp),
    mainGridPower: data.mainGridPower,
    solarOutput: data.solarOutput,
    refrigerationLoad: data.refrigerationLoad,
  }));
  
  const formatXAxis = (timestamp: Date) => {
    if (timeRange === "7d") {
      return format(timestamp, "MM/dd");
    } else {
      return format(timestamp, "HH:mm");
    }
  };
  
  return (
    <div className={cn("chart-container", className)}>
      <div className="p-4 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-medium text-white">Power Usage Timeline</h3>
          <div className="mt-3 md:mt-0 flex flex-wrap gap-2">
            <Button 
              variant={timeRange === "1h" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("1h")}
            >
              1H
            </Button>
            <Button 
              variant={timeRange === "6h" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("6h")}
            >
              6H
            </Button>
            <Button 
              variant={timeRange === "24h" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("24h")}
            >
              24H
            </Button>
            <Button 
              variant={timeRange === "7d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("7d")}
            >
              7D
            </Button>
          </div>
        </div>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatXAxis} 
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
            />
            <YAxis 
              yAxisId="left" 
              orientation="left" 
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
              label={{ value: 'Power (kW)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.6)' }}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(2)} kW`, ""]}
              labelFormatter={(label) => format(new Date(label), "yyyy-MM-dd HH:mm:ss")}
              contentStyle={{ backgroundColor: '#35434a', borderColor: '#44555e' }}
              itemStyle={{ color: 'rgba(255,255,255,0.9)' }}
              labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="mainGridPower" 
              name="Main Supply" 
              stroke="hsl(var(--primary))" 
              yAxisId="left" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="solarOutput" 
              name="Solar Output" 
              stroke="hsl(var(--accent))" 
              yAxisId="left" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="refrigerationLoad" 
              name="Refrigeration" 
              stroke="hsl(var(--chart-3))" 
              yAxisId="left" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
