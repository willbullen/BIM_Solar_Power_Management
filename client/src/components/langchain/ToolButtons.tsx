import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ToolButtonsProps {
  toolName: string;
  setSelectedTool: (tool: any) => void;
  setIsToolModalOpen: (isOpen: boolean) => void;
}

export function ViewSchemaButton({ toolName, setSelectedTool, setIsToolModalOpen }: ToolButtonsProps) {
  const { toast } = useToast();
  
  const handleClick = () => {
    // Create a tool object based on the name
    let toolObject: any = {};
    
    if (toolName === "ReadFromDB") {
      toolObject = {
        id: 1,
        name: "ReadFromDB",
        description: "Reads data from database tables and returns results",
        toolType: "readFromDB",
        parameters: {
          tables: ["users", "power_data", "environmental_data"],
          schema: { type: "database", tables: 23 },
        },
        enabled: true,
        isBuiltIn: true
      };
    } else if (toolName === "CompileReport") {
      toolObject = {
        id: 2,
        name: "CompileReport",
        description: "Compiles data into formatted reports",
        toolType: "compileReport",
        parameters: {
          formats: ["markdown", "pdf"],
          templates: ["summary", "detailed"]
        },
        enabled: true,
        isBuiltIn: true
      };
    }
    
    // Set the selected tool and show a toast notification
    setSelectedTool(toolObject);
    toast({
      title: `${toolName} Schema`,
      description: `Viewing schema information for ${toolName}`,
    });
  };
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="text-slate-400"
      onClick={handleClick}
    >
      View Schema
    </Button>
  );
}

export function ConfigureButton({ toolName, setSelectedTool, setIsToolModalOpen }: ToolButtonsProps) {
  // Create a tool object based on the name
  const handleClick = () => {
    let toolObject: any = {};
    
    if (toolName === "ReadFromDB") {
      toolObject = {
        id: 1,
        name: "ReadFromDB",
        description: "Reads data from database tables and returns results",
        toolType: "readFromDB",
        parameters: {
          tables: ["users", "power_data", "environmental_data"],
          schema: { type: "database", tables: 23 },
        },
        enabled: true,
        isBuiltIn: true
      };
    } else if (toolName === "CompileReport") {
      toolObject = {
        id: 2,
        name: "CompileReport",
        description: "Compiles data into formatted reports",
        toolType: "compileReport",
        parameters: {
          formats: ["markdown", "pdf"],
          templates: ["summary", "detailed"]
        },
        enabled: true,
        isBuiltIn: true
      };
    }
    
    // Set the selected tool and open the tool modal
    setSelectedTool(toolObject);
    setIsToolModalOpen(true);
  };
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="text-blue-400"
      onClick={handleClick}
    >
      Configure
    </Button>
  );
}