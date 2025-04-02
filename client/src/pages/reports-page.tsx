import { useState, useEffect, FormEvent } from "react";
import { PowerDataProvider, usePowerData } from "@/hooks/use-power-data";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileDown, Calendar, ChevronDown, Table } from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Use the exact type from react-day-picker
import { DateRange } from "react-day-picker";

function ReportsContent() {
  const { toast } = useToast();
  const { powerData, environmentalData } = usePowerData();
  const [isExporting, setIsExporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  // Report parameters
  const [dataType, setDataType] = useState<string>("power");
  const [exportFormat, setExportFormat] = useState<string>("csv");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)), // Last 7 days
    to: new Date()
  });
  
  const exportTypes = [
    { value: "power", label: "Power Data" },
    { value: "environmental", label: "Environmental Data" },
    { value: "combined", label: "Combined Data" }
  ];
  
  const exportFormats = [
    { value: "csv", label: "CSV", icon: <FileDown className="mr-2 h-4 w-4" /> },
    { value: "json", label: "JSON", icon: <Table className="mr-2 h-4 w-4" /> }
  ];
  
  // Load preview data when date range or data type changes
  useEffect(() => {
    loadPreviewData();
  }, [dataType, dateRange]);
  
  const loadPreviewData = async () => {
    if (!dateRange.from || !dateRange.to) return;
    
    setIsLoadingPreview(true);
    try {
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");
      let endpoint = '';
      
      if (dataType === 'power') {
        endpoint = `/api/power-data/range?startDate=${fromDate}&endDate=${toDate}`;
      } else if (dataType === 'environmental') {
        endpoint = `/api/environmental-data/range?startDate=${fromDate}&endDate=${toDate}`;
      } else if (dataType === 'combined') {
        endpoint = `/api/export?startDate=${fromDate}&endDate=${toDate}&dataType=combined`;
      }
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`Error fetching preview data: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Only show up to 10 items in preview
      setPreviewData(data.slice(0, 10));
    } catch (error) {
      console.error("Error loading preview data:", error);
      toast({
        title: "Failed to load preview",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
      setPreviewData(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };
  
  const exportData = async () => {
    if (!dateRange.from || !dateRange.to) {
      toast({
        title: "Date range required",
        description: "Please select both start and end dates for your report",
        variant: "destructive",
      });
      return;
    }
    
    setIsExporting(true);
    
    try {
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");
      
      // Create URL with query parameters
      const exportUrl = `/api/export?startDate=${fromDate}&endDate=${toDate}&dataType=${dataType}&format=${exportFormat}`;
      
      // Open in new tab or download
      window.open(exportUrl, "_blank");
      
      toast({
        title: "Export successful",
        description: `Your ${dataType} data has been exported as ${exportFormat.toUpperCase()}.`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-white">Reports & Data Export</h1>
          <p className="text-muted-foreground">Download power monitoring data for analysis</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Export Settings */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Export Configuration</CardTitle>
            <CardDescription>Select data type and export format</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Data Type</Label>
              <Select value={dataType} onValueChange={setDataType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select data type" />
                </SelectTrigger>
                <SelectContent>
                  {exportTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {dataType === 'power' 
                  ? 'Export power consumption metrics (grid, solar, loads)' 
                  : dataType === 'environmental' 
                  ? 'Export weather and environmental metrics' 
                  : 'Combine power and environmental data into a single export'}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="grid gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange.from}
                      selected={{
                        from: dateRange.from,
                        to: dateRange.to,
                      }}
                      onSelect={(range) => 
                        setDateRange(range || { from: undefined, to: undefined })
                      }
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Select the time period for your data export
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select export format" />
                </SelectTrigger>
                <SelectContent>
                  {exportFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      <div className="flex items-center">
                        {format.icon}
                        {format.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {exportFormat === 'csv' 
                  ? 'Download as CSV for use in Excel or other spreadsheet software' 
                  : 'Download as JSON for programmatic analysis or web applications'}
              </p>
            </div>
            
            <Button 
              className="w-full mt-4" 
              onClick={exportData}
              disabled={isExporting || !dateRange.from || !dateRange.to}
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Download Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>
        
        {/* Data Preview */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Data Preview</CardTitle>
            <CardDescription>
              {isLoadingPreview 
                ? "Loading preview data..." 
                : `Showing ${previewData?.length || 0} rows of data (limited to 10)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPreview ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : previewData && previewData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse table-auto text-sm">
                  <thead>
                    <tr className="border-b border-muted bg-muted/50">
                      <th className="p-2 text-left font-medium">Timestamp</th>
                      {Object.keys(previewData[0])
                        .filter(key => key !== 'timestamp' && key !== 'id')
                        .map(key => (
                          <th key={key} className="p-2 text-left font-medium">
                            {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i} className="border-b border-muted">
                        <td className="p-2 align-top">
                          {format(new Date(row.timestamp), "MMM d, yyyy HH:mm")}
                        </td>
                        {Object.entries(row)
                          .filter(([key]) => key !== 'timestamp' && key !== 'id')
                          .map(([key, value]) => (
                            <td key={key} className="p-2 align-top">
                              {typeof value === 'number' 
                                ? value.toFixed(2) 
                                : value === null 
                                  ? '-' 
                                  : String(value)}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <p className="text-muted-foreground mb-4">No data available for the selected date range</p>
                <Button variant="outline" onClick={loadPreviewData}>
                  Refresh Data
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  return (
    <PowerDataProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <Header onToggleSidebar={toggleSidebar} />
        
        <div className="flex flex-1 overflow-hidden">
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
          
          <main className={`flex-1 app-content p-4 ${sidebarCollapsed ? '' : 'lg:ml-64'}`}>
            <ReportsContent />
          </main>
        </div>
      </div>
    </PowerDataProvider>
  );
}