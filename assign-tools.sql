-- SQL script to manage tool assignments for agents

-- Display available agents
SELECT id, name, enabled FROM langchain_agents ORDER BY id;

-- Display available tools
SELECT id, name, enabled FROM langchain_tools ORDER BY id;

-- Show current tool assignments
SELECT 
    at.id, 
    a.name AS agent_name, 
    t.name AS tool_name, 
    at.priority
FROM 
    langchain_agent_tools at
JOIN 
    langchain_agents a ON at.agent_id = a.id
JOIN 
    langchain_tools t ON at.tool_id = t.id
ORDER BY 
    a.name, at.priority;

-- To assign a tool to an agent, uncomment and replace the values:
-- INSERT INTO langchain_agent_tools (agent_id, tool_id, priority)
-- VALUES (1, 1, 0)  -- Replace with agent_id, tool_id, and priority
-- ON CONFLICT (agent_id, tool_id) DO UPDATE 
-- SET priority = EXCLUDED.priority;

-- To remove a tool from an agent, uncomment and replace the values:
-- DELETE FROM langchain_agent_tools 
-- WHERE agent_id = 1 AND tool_id = 1;  -- Replace with agent_id and tool_id

-- Recommended: Enable the ReadFromDB tool for the Main Assistant Agent
-- If tool ID 1 is the ReadFromDB tool and agent ID 1 is the Main Assistant:
-- INSERT INTO langchain_agent_tools (agent_id, tool_id, priority)
-- VALUES (1, 1, 0)
-- ON CONFLICT (agent_id, tool_id) DO UPDATE 
-- SET priority = EXCLUDED.priority;

-- Recommended: Enable the CompileReport tool for the Main Assistant Agent
-- If tool ID 2 is the CompileReport tool and agent ID 1 is the Main Assistant:
-- INSERT INTO langchain_agent_tools (agent_id, tool_id, priority)
-- VALUES (1, 2, 1)
-- ON CONFLICT (agent_id, tool_id) DO UPDATE 
-- SET priority = EXCLUDED.priority;