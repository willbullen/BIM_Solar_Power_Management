import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { RunnableSequence } from "@langchain/core/runnables";
import { formatToOpenAIFunctionMessages } from "langchain/agents/format_utils";
import { Tool, StructuredTool } from "@langchain/core/tools";
import { db } from "../db";
import { ReadFromDBTool } from "./tools/readFromDB";
import { CompileReportTool } from "./tools/compileReport";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

/**
 * Interface for agent configuration
 */
export interface AgentConfig {
  agentId?: number;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  systemPrompt?: string;
  maxIterations?: number;
  verbose?: boolean;
}

/**
 * Create a LangChain agent with the specified tools and configuration
 */
export async function createAgent(
  config: AgentConfig = {}
): Promise<AgentExecutor> {
  // Check if we should use a specific agent from database
  let agentConfig: AgentConfig = { ...config };
  
  if (config.agentId) {
    // Get agent configuration from database
    try {
      const [agent] = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.id, config.agentId));
      
      if (agent) {
        agentConfig = {
          ...agentConfig,
          modelName: agent.modelName,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          streaming: agent.streaming,
          systemPrompt: agent.systemPrompt,
          maxIterations: agent.maxIterations,
          verbose: agent.verbose
        };
      }
    } catch (error) {
      console.error(`Error loading agent configuration for agentId ${config.agentId}:`, error);
    }
  }
  
  // Set defaults for any missing configuration
  const finalConfig = {
    modelName: agentConfig.modelName || "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    temperature: agentConfig.temperature || 0.7,
    maxTokens: agentConfig.maxTokens || 4000,
    streaming: agentConfig.streaming !== undefined ? agentConfig.streaming : true,
    systemPrompt: agentConfig.systemPrompt || "You are an advanced AI assistant with access to database querying and report generation capabilities. Help users analyze data and create reports. You should be concise and direct in your responses.",
    maxIterations: agentConfig.maxIterations || 5,
    verbose: agentConfig.verbose || false
  };
  
  // Initialize the model
  const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: finalConfig.modelName,
    temperature: finalConfig.temperature,
    maxTokens: finalConfig.maxTokens,
    streaming: finalConfig.streaming,
  });
  
  // Initialize tools with LangChain-compatible adapters
  // Convert custom tools to make them compatible with the expected schema format
  const readFromDBTool = new ReadFromDBTool();
  const compileReportTool = new CompileReportTool();

  // Set up tools to be compatible with LangChain's OpenAI functions format
  const tools: Tool[] = [
    readFromDBTool,
    compileReportTool,
  ];
  
  // Create the agent prompt
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", finalConfig.systemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);
  
  // Create the agent
  const agent = await createOpenAIFunctionsAgent({
    llm: model,
    tools,
    prompt,
  });
  
  // Create the agent executor
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    maxIterations: finalConfig.maxIterations,
    verbose: finalConfig.verbose,
  });
  
  return agentExecutor;
}

/**
 * Process a conversation message with the LangChain agent
 */
export async function processMessage(
  message: string,
  conversationId: number,
  config: AgentConfig = {}
): Promise<string> {
  try {
    // Create a new agent
    const agent = await createAgent(config);
    
    // Get previous conversation history if available
    let chatHistory = [];
    if (conversationId) {
      try {
        const messages = await db
          .select()
          .from(schema.agentMessages)
          .where(eq(schema.agentMessages.conversationId, conversationId))
          .orderBy(schema.agentMessages.timestamp);
        
        // Convert to LangChain message format
        chatHistory = messages.map(msg => {
          if (msg.role === 'user') {
            return new HumanMessage(msg.content.toString());
          } else if (msg.role === 'assistant') {
            return new AIMessage(msg.content.toString());
          }
          return null;
        }).filter(Boolean);
      } catch (error) {
        console.error(`Error loading conversation history for ID ${conversationId}:`, error);
      }
    }
    
    // Create a unique run ID
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Record the run start - include required run_type and properly handle input
    await db
      .insert(schema.langchainRuns)
      .values({
        runId,
        agentId: config.agentId || null,
        userId: null, // This would be filled with actual user ID if available
        startTime: new Date(),
        status: 'running',
        input: JSON.stringify({ message }), // Convert to string for TEXT column
        run_type: 'conversation', // Required field
      });
    
    try {
      // Invoke the agent with the message and chat history
      const result = await agent.invoke({
        input: message,
        chat_history: chatHistory,
      });
      
      // Update run with result - ensure output is properly stringified
      await db
        .update(schema.langchainRuns)
        .set({
          endTime: new Date(),
          status: 'completed',
          output: JSON.stringify({ response: result.output }), // Convert object to string for TEXT column
        })
        .where(eq(schema.langchainRuns.runId, String(runId)));
      
      return result.output;
    } catch (error) {
      // Update run with error - properly handle error message and runId as string
      await db
        .update(schema.langchainRuns)
        .set({
          endTime: new Date(),
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
        .where(eq(schema.langchainRuns.runId, String(runId)));
      
      throw error;
    }
  } catch (error) {
    console.error("Error processing LangChain message:", error);
    return `Error processing your message: ${error.message}`;
  }
}