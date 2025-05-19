/**
 * LangChain Tool Discovery Utility
 * 
 * This utility provides functionality to discover available LangChain tools
 * and map them to appropriate categories for better organization.
 */

import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

// Define tool categories
export const TOOL_CATEGORIES = {
  WEB: "Web Tools",
  DATA: "Data Tools",
  SEARCH: "Search Tools",
  NLP: "NLP Tools",
  FINANCIAL: "Financial Tools",
  MATH: "Math Tools",
  SYSTEM: "System Tools",
  API: "API Tools",
  UTILITY: "Utility Tools",
  OTHER: "Other Tools",
};

// Type for tool information
export interface ToolInfo {
  name: string;
  description: string;
  type: string;
  category: string;
  parameters?: any;
  implementation?: string;
}

/**
 * Predefined list of available tools that can be registered
 * This approach avoids the dynamic import issues with LangChain
 */
const PREDEFINED_TOOLS: ToolInfo[] = [
  {
    name: 'WebBrowser',
    description: 'A tool for browsing web pages and extracting information from them.',
    type: 'langchain',
    category: TOOL_CATEGORIES.WEB,
    parameters: {
      url: { type: 'string', description: 'The URL to browse' }
    }
  },
  {
    name: 'ReadFromDB',
    description: 'Reads data from the database based on a structured query.',
    type: 'custom',
    category: TOOL_CATEGORIES.DATA,
    parameters: {
      query: { type: 'string', description: 'The SQL query to execute' }
    }
  },
  {
    name: 'CompileReport',
    description: 'Compiles a report from various data sources and formats it for presentation.',
    type: 'custom',
    category: TOOL_CATEGORIES.DATA,
    parameters: {
      reportType: { type: 'string', description: 'The type of report to compile' },
      timeRange: { type: 'string', description: 'Time range for the report data' }
    }
  },
  {
    name: 'RequestsGet',
    description: 'Makes a GET request to the specified URL and returns the response.',
    type: 'langchain',
    category: TOOL_CATEGORIES.WEB,
    parameters: {
      url: { type: 'string', description: 'The URL to make the GET request to' }
    }
  },
  {
    name: 'RequestsPost',
    description: 'Makes a POST request to the specified URL with the provided data and returns the response.',
    type: 'langchain',
    category: TOOL_CATEGORIES.WEB,
    parameters: {
      url: { type: 'string', description: 'The URL to make the POST request to' },
      data: { type: 'object', description: 'The data to send in the POST request' }
    }
  },
  {
    name: 'EnvironmentalDataFetcher',
    description: 'Fetches environmental data like weather, temperature, and solar radiation.',
    type: 'custom',
    category: TOOL_CATEGORIES.DATA,
    parameters: {
      dataType: { type: 'string', description: 'Type of environmental data to fetch' },
      timeRange: { type: 'string', description: 'Time range for the data' }
    }
  },
  {
    name: 'PowerDataAnalyzer',
    description: 'Analyzes power consumption and generation data to provide insights.',
    type: 'custom',
    category: TOOL_CATEGORIES.DATA,
    parameters: {
      dataSource: { type: 'string', description: 'Source of power data' },
      analysisType: { type: 'string', description: 'Type of analysis to perform' }
    }
  },
  {
    name: 'TextSummarizer',
    description: 'Summarizes large texts into concise summaries.',
    type: 'langchain',
    category: TOOL_CATEGORIES.NLP,
    parameters: {
      text: { type: 'string', description: 'The text to summarize' },
      maxLength: { type: 'number', description: 'Maximum length of the summary' }
    }
  },
  {
    name: 'ReportGenerator',
    description: 'Generates formatted reports based on provided data.',
    type: 'custom',
    category: TOOL_CATEGORIES.UTILITY,
    parameters: {
      data: { type: 'object', description: 'The data to include in the report' },
      format: { type: 'string', description: 'Format of the report (PDF, HTML, etc.)' }
    }
  },
  {
    name: 'SolcastDataFetcher',
    description: 'Fetches solar forecasting data from Solcast API.',
    type: 'custom',
    category: TOOL_CATEGORIES.API,
    parameters: {
      location: { type: 'object', description: 'Latitude and longitude coordinates' },
      period: { type: 'string', description: 'Forecast period' }
    }
  }
];

/**
 * Checks if a tool already exists in the database
 */
export function isToolDuplicate(toolName: string, existingTools: any[]): boolean {
  return existingTools.some(tool => tool.name === toolName);
}

/**
 * Discovers available tools that can be registered
 */
export function discoverAvailableTools(): ToolInfo[] {
  return PREDEFINED_TOOLS;
}

/**
 * Registers a new tool in the database
 */
export async function registerTool(db: any, toolData: any) {
  const { 
    name, description, toolType, parameters, implementation, 
    enabled, isBuiltIn, metadata, agentId 
  } = toolData;
  
  // Insert the new tool
  const [newTool] = await db.insert(schema.langchainTools).values({
    name,
    description: description || '',
    toolType: toolType || 'custom',
    parameters: parameters || {},
    implementation: implementation || '',
    enabled: enabled !== undefined ? enabled : true,
    isBuiltIn: isBuiltIn || false,
    metadata: metadata || {}
  }).returning();
  
  // If agentId is provided, assign the tool to the agent
  if (agentId) {
    await db.insert(schema.langchainAgentTools).values({
      agentId: parseInt(agentId),
      toolId: newTool.id,
      priority: 0,
      isEnabled: true
    });
  }
  
  return newTool;
}