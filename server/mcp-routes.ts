import express from "express";
import { mcpService } from "./services/mcp-service";
import { z } from "zod";
import { insertMcpTaskSchema } from "../shared/schema";

const router = express.Router();

/**
 * Get all available capabilities
 */
router.get("/capabilities", async (req, res) => {
  try {
    // Get user role from session if authenticated
    const userRole = req.session.user?.role;
    
    const capabilities = mcpService.getAvailableCapabilities(userRole);
    
    return res.json({
      success: true,
      capabilities: capabilities.map(cap => ({
        name: cap.name,
        description: cap.description,
        category: cap.category,
        parameters: cap.parameters || {}
      }))
    });
  } catch (error) {
    console.error("Error fetching capabilities:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch capabilities"
    });
  }
});

/**
 * Get a specific capability by name
 */
router.get("/capabilities/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const capability = mcpService.getCapability(name);
    
    if (!capability) {
      return res.status(404).json({
        success: false,
        error: `Capability '${name}' not found`
      });
    }
    
    // Check if user has access to this capability
    const userRole = req.session.user?.role;
    if (capability.requiresAuth && !req.session.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required to access this capability"
      });
    }
    
    if (capability.requiredRole && userRole && 
        !capability.requiredRole.includes(userRole) && 
        userRole !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions to access this capability"
      });
    }
    
    return res.json({
      success: true,
      capability: {
        name: capability.name,
        description: capability.description,
        category: capability.category,
        parameters: capability.parameters || {}
      }
    });
  } catch (error) {
    console.error(`Error fetching capability:`, error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch capability"
    });
  }
});

/**
 * Create a new MCP task
 */
router.post("/tasks", async (req, res) => {
  try {
    // Validate request body against schema
    const validationResult = insertMcpTaskSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.errors
      });
    }
    
    // Ensure user is authenticated
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required to create tasks"
      });
    }
    
    // Set the creator to the current user
    const taskData = {
      ...validationResult.data,
      createdBy: req.session.user.id
    };
    
    const task = await mcpService.createTask(taskData);
    
    return res.status(201).json({
      success: true,
      task
    });
  } catch (error) {
    console.error("Error creating MCP task:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create task"
    });
  }
});

/**
 * Get all MCP tasks with optional filtering
 */
router.get("/tasks", async (req, res) => {
  try {
    const { status, capability, userId } = req.query;
    
    // If user is not an admin, they can only see their own tasks
    const userRole = req.session.user?.role;
    const userIdFilter = 
      userRole === 'Admin' 
        ? userId ? Number(userId) : undefined
        : req.session.user?.id;
    
    const filter = {
      status: status as string | undefined,
      capability: capability as string | undefined,
      userId: userIdFilter
    };
    
    const tasks = await mcpService.getAllTasks(filter);
    
    return res.json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error("Error fetching MCP tasks:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch tasks"
    });
  }
});

/**
 * Get a specific MCP task by ID
 */
router.get("/tasks/:id", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    
    if (isNaN(taskId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid task ID"
      });
    }
    
    const task = await mcpService.getTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: `Task with ID ${taskId} not found`
      });
    }
    
    // If user is not an admin, they can only see their own tasks
    const userRole = req.session.user?.role;
    if (userRole !== 'Admin' && task.createdBy !== req.session.user?.id) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to access this task"
      });
    }
    
    return res.json({
      success: true,
      task
    });
  } catch (error) {
    console.error(`Error fetching MCP task:`, error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch task"
    });
  }
});

/**
 * Update task status
 */
router.patch("/tasks/:id/status", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    
    if (isNaN(taskId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid task ID"
      });
    }
    
    // Validate request body
    const schema = z.object({
      status: z.enum(['pending', 'in-progress', 'completed', 'failed', 'canceled']),
      result: z.any().optional()
    });
    
    const validationResult = schema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.errors
      });
    }
    
    const { status, result } = validationResult.data;
    
    // Get the task to check permissions
    const task = await mcpService.getTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: `Task with ID ${taskId} not found`
      });
    }
    
    // Check permissions - only admin or task creator can update status
    const userRole = req.session.user?.role;
    if (userRole !== 'Admin' && task.createdBy !== req.session.user?.id) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to update this task"
      });
    }
    
    const updatedTask = await mcpService.updateTaskStatus(taskId, status, result);
    
    return res.json({
      success: true,
      task: updatedTask
    });
  } catch (error) {
    console.error(`Error updating MCP task status:`, error);
    return res.status(500).json({
      success: false,
      error: "Failed to update task status"
    });
  }
});

/**
 * Delete a task
 */
router.delete("/tasks/:id", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    
    if (isNaN(taskId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid task ID"
      });
    }
    
    // Get the task to check permissions
    const task = await mcpService.getTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: `Task with ID ${taskId} not found`
      });
    }
    
    // Check permissions - only admin or task creator can delete
    const userRole = req.session.user?.role;
    if (userRole !== 'Admin' && task.createdBy !== req.session.user?.id) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to delete this task"
      });
    }
    
    const success = await mcpService.deleteTask(taskId);
    
    return res.json({
      success
    });
  } catch (error) {
    console.error(`Error deleting MCP task:`, error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete task"
    });
  }
});

/**
 * Execute a task manually
 */
router.post("/tasks/:id/execute", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    
    if (isNaN(taskId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid task ID"
      });
    }
    
    // Get the task to check permissions
    const task = await mcpService.getTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: `Task with ID ${taskId} not found`
      });
    }
    
    // Check permissions - only admin or task creator can execute
    const userRole = req.session.user?.role;
    if (userRole !== 'Admin' && task.createdBy !== req.session.user?.id) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to execute this task"
      });
    }
    
    // Execute the task
    const result = await mcpService.executeTask(taskId);
    
    return res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error(`Error executing MCP task:`, error);
    return res.status(500).json({
      success: false,
      error: "Failed to execute task",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Process all pending tasks (admin only)
 */
router.post("/tasks/process-pending", async (req, res) => {
  try {
    // Check if user is admin
    const userRole = req.session.user?.role;
    if (userRole !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: "Only administrators can process pending tasks"
      });
    }
    
    const result = await mcpService.processPendingTasks();
    
    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("Error processing pending MCP tasks:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to process pending tasks"
    });
  }
});

export default router;