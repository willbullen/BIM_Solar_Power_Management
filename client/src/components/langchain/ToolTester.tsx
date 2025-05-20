import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ToolTesterProps {
  tool: any;
}

export function ToolTester({ tool }: ToolTesterProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [testParameters, setTestParameters] = useState<Record<string, any>>({});
  const [testResults, setTestResults] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("parameters");

  const updateParameter = (paramName: string, value: any) => {
    setTestParameters({
      ...testParameters,
      [paramName]: value,
    });
  };

  const runTest = async () => {
    setIsLoading(true);
    setTestResults("");

    try {
      // Validate parameters against requirements
      if (tool.parameters) {
        const missingRequired = Object.entries(tool.parameters)
          .filter(([_, config]: [string, any]) => config.required && config.required === true)
          .map(([paramName]: [string, any]) => paramName)
          .filter(paramName => !testParameters[paramName] && testParameters[paramName] !== false);

        if (missingRequired.length > 0) {
          toast({
            title: "Missing required parameters",
            description: `Please provide values for: ${missingRequired.join(", ")}`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      // Convert parameter values to appropriate types
      const convertedParams = Object.entries(testParameters).reduce((acc, [key, value]) => {
        const paramType = tool.parameters?.[key]?.type || "string";
        
        let convertedValue = value;
        if (paramType === "number" && value !== "") {
          convertedValue = Number(value);
        } else if (paramType === "boolean") {
          convertedValue = String(value).toLowerCase() === "true";
        } else if (paramType === "object" && typeof value === "string") {
          try {
            convertedValue = JSON.parse(value);
          } catch (e) {
            // Keep as string if can't parse
          }
        } else if (paramType === "array" && typeof value === "string") {
          try {
            convertedValue = JSON.parse(value);
            if (!Array.isArray(convertedValue)) {
              convertedValue = [convertedValue];
            }
          } catch (e) {
            // If parsing fails, split by comma
            convertedValue = value.split(",").map(item => item.trim());
          }
        }
        
        return {
          ...acc,
          [key]: convertedValue,
        };
      }, {});

      const response = await apiRequest({
        path: `api/langchain/tools/${tool.id}/test`,
        method: "POST",
        body: {
          parameters: convertedParams,
        },
      });

      if (response) {
        setTestResults(typeof response.result === 'object' 
          ? JSON.stringify(response.result, null, 2) 
          : String(response.result));
        setActiveTab("results");
      }
    } catch (error: any) {
      setTestResults(`Error: ${error.message || "Failed to test tool"}`);
      setActiveTab("results");
      toast({
        title: "Tool test failed",
        description: error.message || "Failed to test tool",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderParameterInput = (paramName: string, paramConfig: any) => {
    const paramType = paramConfig?.type || "string";
    const paramDescription = paramConfig?.description || "";
    const isRequired = paramConfig?.required === true;
    
    if (paramType === "boolean") {
      return (
        <div className="grid gap-2" key={paramName}>
          <Label htmlFor={`param-${paramName}`} className="flex items-center gap-2">
            {paramName} 
            {isRequired && <span className="text-xs text-red-500">*</span>}
            <span className="text-xs text-muted-foreground">({paramType})</span>
          </Label>
          <select
            id={`param-${paramName}`}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={testParameters[paramName] === true ? "true" : "false"}
            onChange={(e) => updateParameter(paramName, e.target.value === "true")}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
          {paramDescription && <p className="text-xs text-muted-foreground">{paramDescription}</p>}
        </div>
      );
    }
    
    if (paramType === "object" || paramType === "array") {
      return (
        <div className="grid gap-2" key={paramName}>
          <Label htmlFor={`param-${paramName}`} className="flex items-center gap-2">
            {paramName} 
            {isRequired && <span className="text-xs text-red-500">*</span>}
            <span className="text-xs text-muted-foreground">({paramType})</span>
          </Label>
          <Textarea
            id={`param-${paramName}`}
            placeholder={paramType === "object" ? '{"key": "value"}' : '["item1", "item2"]'}
            value={testParameters[paramName] || ""}
            onChange={(e) => updateParameter(paramName, e.target.value)}
            className="font-mono text-sm"
          />
          {paramDescription && <p className="text-xs text-muted-foreground">{paramDescription}</p>}
        </div>
      );
    }
    
    return (
      <div className="grid gap-2" key={paramName}>
        <Label htmlFor={`param-${paramName}`} className="flex items-center gap-2">
          {paramName} 
          {isRequired && <span className="text-xs text-red-500">*</span>}
          <span className="text-xs text-muted-foreground">({paramType})</span>
        </Label>
        <Input
          id={`param-${paramName}`}
          type={paramType === "number" ? "number" : "text"}
          placeholder={`Enter ${paramName}`}
          value={testParameters[paramName] || ""}
          onChange={(e) => updateParameter(paramName, e.target.value)}
        />
        {paramDescription && <p className="text-xs text-muted-foreground">{paramDescription}</p>}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Test Tool: {tool.name}</CardTitle>
        <CardDescription>{tool.description}</CardDescription>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="parameters">
          <CardContent className="space-y-4 pt-4">
            {!tool.parameters || Object.entries(tool.parameters).length === 0 ? (
              <p className="text-sm text-muted-foreground">This tool doesn't have any parameters.</p>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {Object.entries(tool.parameters).map(([paramName, paramConfig]: [string, any]) => 
                  renderParameterInput(paramName, paramConfig)
                )}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={runTest} 
              disabled={isLoading} 
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                  Testing...
                </>
              ) : (
                "Run Test"
              )}
            </Button>
          </CardFooter>
        </TabsContent>
        
        <TabsContent value="results">
          <CardContent className="pt-4">
            <ScrollArea className="h-[300px] w-full rounded-md border p-4">
              <pre className="font-mono text-sm whitespace-pre-wrap">
                {testResults || "Test results will appear here..."}
              </pre>
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => setActiveTab("parameters")}
            >
              Back to Parameters
            </Button>
            <Button 
              onClick={runTest} 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                  Testing...
                </>
              ) : (
                "Run Test Again"
              )}
            </Button>
          </CardFooter>
        </TabsContent>
      </Tabs>
    </Card>
  );
}