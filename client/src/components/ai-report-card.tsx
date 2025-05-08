import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Download, FileDown, Clock, ArrowUpDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAIAnalytics } from "@/hooks/use-ai-analytics";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface AIReportCardProps {
  historicalPowerData: any[];
  historicalEnvData: any[];
  className?: string;
}

export function AIReportCard({ historicalPowerData, historicalEnvData, className }: AIReportCardProps) {
  const [report, setReport] = useState<any | null>(null);
  const [reportType, setReportType] = useState<string>("custom");
  const { generateReport, isLoading } = useAIAnalytics();
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    try {
      const result = await generateReport(reportType, historicalPowerData, historicalEnvData);
      setReport(result);
    } catch (error) {
      console.error("Failed to generate report:", error);
      toast({
        title: "Report Generation Failed",
        description: "There was an error generating the report. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle report download
  const handleDownloadReport = () => {
    if (!report) return;
    
    // Format report as text
    const reportText = formatReportForDownload(report);
    
    // Create and download file
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${report.title.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format the report object as downloadable text
  const formatReportForDownload = (report: any): string => {
    let text = `${report.title.toUpperCase()}\n`;
    text += `${"-".repeat(report.title.length)}\n\n`;
    text += `Generated: ${report.generatedAt}\n`;
    text += `Period: ${report.period}\n\n`;
    
    text += `EXECUTIVE SUMMARY\n`;
    text += `${"-".repeat(16)}\n`;
    text += `${report.executiveSummary}\n\n`;
    
    if (report.keyMetrics && report.keyMetrics.length > 0) {
      text += `KEY METRICS\n`;
      text += `${"-".repeat(11)}\n`;
      report.keyMetrics.forEach((metric: any) => {
        text += `* ${metric.name}: ${metric.value} (${metric.change}) - ${metric.interpretation}\n`;
      });
      text += "\n";
    }
    
    if (report.sections && report.sections.length > 0) {
      report.sections.forEach((section: any) => {
        text += `${section.title.toUpperCase()}\n`;
        text += `${"-".repeat(section.title.length)}\n`;
        text += `${section.content}\n\n`;
        
        if (section.charts && section.charts.length > 0) {
          text += "Charts:\n";
          section.charts.forEach((chart: any) => {
            text += `- ${chart.title}: ${chart.interpretation}\n`;
          });
          text += "\n";
        }
      });
    }
    
    if (report.recommendations && report.recommendations.length > 0) {
      text += `RECOMMENDATIONS\n`;
      text += `${"-".repeat(15)}\n`;
      report.recommendations.forEach((rec: any, i: number) => {
        text += `${i + 1}. ${rec.title} (Priority: ${rec.priority})\n`;
        text += `   ${rec.description}\n`;
        text += `   Impact: ${rec.impact}\n\n`;
      });
    }
    
    text += `CONCLUSION\n`;
    text += `${"-".repeat(10)}\n`;
    text += `${report.conclusion}\n`;
    
    return text;
  };

  // Helper to render priority badge
  const renderPriorityBadge = (priority: string) => {
    let variant = "outline";
    
    switch (priority) {
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
        {priority}
      </Badge>
    );
  };

  return (
    <Card className={cn("shadow-md", className)}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="mr-2 h-5 w-5" />
          AI-Generated Report
        </CardTitle>
        <CardDescription>
          Comprehensive analysis reports generated using AI
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Generating your personalized report...</p>
          </div>
        ) : report ? (
          <div className="space-y-6">
            {/* Report Header */}
            <div>
              <h3 className="text-xl font-bold">{report.title}</h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  <span>Generated: {new Date(report.generatedAt).toLocaleString()}</span>
                </div>
                <div className="hidden sm:block">•</div>
                <div>Period: {report.period}</div>
              </div>
            </div>
            
            {/* Executive Summary */}
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Executive Summary</h4>
              <p className="text-muted-foreground">{report.executiveSummary}</p>
            </div>
            
            {/* Key Metrics */}
            {report.keyMetrics && report.keyMetrics.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Key Metrics</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {report.keyMetrics.map((metric: any, index: number) => (
                    <div key={index} className="p-3 rounded-lg border">
                      <div className="text-sm text-muted-foreground">{metric.name}</div>
                      <div className="flex items-center mt-1">
                        <span className="text-lg font-semibold">{metric.value}</span>
                        <span className={cn(
                          "text-xs ml-2 flex items-center",
                          metric.trend === "improving" ? "text-green-500" : 
                          metric.trend === "declining" ? "text-red-500" : "text-yellow-500"
                        )}>
                          {metric.change}
                          {metric.trend === "improving" && <ArrowUpDown className="h-3 w-3 ml-1" />}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{metric.interpretation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <Separator />
            
            {/* Report Sections */}
            {report.sections && report.sections.length > 0 && (
              <div className="space-y-6">
                {report.sections.map((section: any, index: number) => (
                  <div key={index}>
                    <h4 className="font-medium mb-3">{section.title}</h4>
                    <p className="text-muted-foreground whitespace-pre-line">{section.content}</p>
                    
                    {section.charts && section.charts.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {section.charts.map((chart: any, chartIndex: number) => (
                          <div key={chartIndex} className="p-3 rounded-lg bg-muted/30">
                            <div className="font-medium text-sm">{chart.title}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {chart.interpretation}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <Separator />
            
            {/* Recommendations */}
            {report.recommendations && report.recommendations.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Recommendations</h4>
                <div className="space-y-3">
                  {report.recommendations.map((rec: any, index: number) => (
                    <div key={index} className="p-3 rounded-lg border">
                      <div className="font-medium flex items-center">
                        {rec.title}
                        {renderPriorityBadge(rec.priority)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                      {rec.impact && (
                        <div className="text-sm mt-2">
                          <span className="font-medium">Impact: </span>
                          <span className="text-muted-foreground">{rec.impact}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Conclusion */}
            {report.conclusion && (
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2">Conclusion</h4>
                <p className="text-muted-foreground">{report.conclusion}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Generate Executive Report</h3>
            <p className="text-muted-foreground mb-6">
              Create detailed reports with insights, analysis, and recommendations based on your power and environmental data.
            </p>
            
            <div className="w-full max-w-sm space-y-4">
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Report Type</SelectLabel>
                    <SelectItem value="daily">Daily Report</SelectItem>
                    <SelectItem value="weekly">Weekly Report</SelectItem>
                    <SelectItem value="monthly">Monthly Report</SelectItem>
                    <SelectItem value="custom">Custom Report</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              
              <Button onClick={handleGenerateReport} className="w-full">
                Generate Report
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      
      {report && (
        <CardFooter className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={handleGenerateReport} className="w-full sm:w-auto">
            <FileText className="h-4 w-4 mr-2" />
            Refresh Report
          </Button>
          <Button variant="secondary" onClick={handleDownloadReport} className="w-full sm:w-auto sm:ml-auto">
            <FileDown className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}