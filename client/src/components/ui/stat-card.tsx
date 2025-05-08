import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  className?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    positive?: boolean;
  };
  loading?: boolean;
}

export function StatCard({
  title,
  value,
  description,
  className,
  icon: Icon,
  trend,
  loading = false
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-28 animate-pulse rounded-md bg-muted"></div>
        ) : (
          <div className="text-2xl font-bold">
            {value}
            {trend && (
              <span 
                className={cn(
                  "ml-2 text-xs font-medium",
                  trend.positive ? "text-green-500" : "text-red-500"
                )}
              >
                {trend.positive ? "+" : "-"}{Math.abs(trend.value).toFixed(2)}%
              </span>
            )}
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground pt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}