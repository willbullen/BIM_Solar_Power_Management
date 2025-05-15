import { UnifiedFunctionRegistry } from './unified-function-registry';

/**
 * Sample functions for the AI agent
 * These are used to register example functions for the agent to use
 */

/**
 * Register all sample functions
 */
export async function registerSampleFunctions() {
  
  // Power data analysis function - public access
  await UnifiedFunctionRegistry.registerFunction({
    name: 'analyzePowerData',
    description: 'Analyze power data for a given time period to identify patterns and anomalies',
    toolType: 'custom',
    metadata: { 
      module: 'power',
      returnType: 'PowerDataAnalysis'
    },
    parameters: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date for the analysis (ISO format)'
        },
        endDate: {
          type: 'string',
          description: 'End date for the analysis (ISO format)'
        },
        metrics: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Metrics to analyze (e.g., mainGridPower, solarOutput, etc.)'
        }
      },
      required: ['startDate', 'endDate']
    },
    implementation: `
      async function analyzePowerData(params, dbUtils) {
        const { startDate, endDate, metrics = ['mainGridPower', 'solarOutput', 'totalLoad'] } = params;
        
        // Get power data for the specified period
        const powerData = await dbUtils.select('power_data', {}, {
          orderBy: [{ column: 'timestamp', direction: 'asc' }]
        });
        
        // Filter data by date range
        const filteredData = powerData.filter(data => {
          const timestamp = new Date(data.timestamp);
          return timestamp >= new Date(startDate) && timestamp <= new Date(endDate);
        });
        
        // Calculate basic statistics for each metric
        const results = {};
        
        for (const metric of metrics) {
          if (filteredData.length === 0) {
            results[metric] = { 
              average: 0, 
              min: 0, 
              max: 0, 
              total: 0,
              count: 0 
            };
            continue;
          }
          
          const values = filteredData.map(data => data[metric] || 0);
          
          results[metric] = {
            average: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            total: values.reduce((a, b) => a + b, 0),
            count: values.length
          };
        }
        
        // Add insights based on the data
        const insights = [];
        
        if (results.solarOutput && results.mainGridPower) {
          const solarRatio = results.solarOutput.total / (results.mainGridPower.total + results.solarOutput.total);
          insights.push({
            type: 'energy_mix',
            message: \`Solar power accounted for \${(solarRatio * 100).toFixed(2)}% of total energy production\`,
            value: solarRatio
          });
        }
        
        if (results.totalLoad) {
          const avgDailyLoad = results.totalLoad.total / (filteredData.length / 24); // Assuming hourly data
          insights.push({
            type: 'consumption',
            message: \`Average daily energy consumption was \${avgDailyLoad.toFixed(2)} kWh\`,
            value: avgDailyLoad
          });
        }
        
        return {
          period: {
            start: startDate,
            end: endDate
          },
          metrics: results,
          dataPoints: filteredData.length,
          insights
        };
      }
      
      return await analyzePowerData(params, dbUtils);
    `,
    isBuiltIn: true,
    metadata: {
      accessLevel: 'public',
      tags: ['power', 'analytics', 'statistics']
    }
  });
  
  // Environmental correlation function - requires user role
  await UnifiedFunctionRegistry.registerFunction({
    name: 'correlateEnvironmentalFactors',
    description: 'Correlate environmental factors with power production and consumption',
    toolType: 'custom',
    metadata: {
      module: 'environment',
      accessLevel: 'user',
      returnType: 'CorrelationAnalysis'
    },
    parameters: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date for the correlation (ISO format)'
        },
        endDate: {
          type: 'string',
          description: 'End date for the correlation (ISO format)'
        },
        factors: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Environmental factors to correlate (e.g., air_temp, ghi, dni, humidity)'
        }
      },
      required: ['startDate', 'endDate']
    },
    implementation: `
      async function correlateEnvironmentalFactors(params, dbUtils) {
        const { startDate, endDate, factors = ['air_temp', 'ghi', 'dni'] } = params;
        
        // Get environmental data for the specified period
        const envData = await dbUtils.select('environmental_data', {}, {
          orderBy: [{ column: 'timestamp', direction: 'asc' }]
        });
        
        // Get power data for the specified period
        const powerData = await dbUtils.select('power_data', {}, {
          orderBy: [{ column: 'timestamp', direction: 'asc' }]
        });
        
        // Filter data by date range
        const filteredEnvData = envData.filter(data => {
          const timestamp = new Date(data.timestamp);
          return timestamp >= new Date(startDate) && timestamp <= new Date(endDate);
        });
        
        const filteredPowerData = powerData.filter(data => {
          const timestamp = new Date(data.timestamp);
          return timestamp >= new Date(startDate) && timestamp <= new Date(endDate);
        });
        
        // Calculate correlations
        const correlations = {};
        
        for (const factor of factors) {
          correlations[factor] = {
            mainGridPower: calculateCorrelation(
              filteredEnvData.map(d => d[factor] || 0),
              filteredPowerData.map(d => d.mainGridPower || 0)
            ),
            solarOutput: calculateCorrelation(
              filteredEnvData.map(d => d[factor] || 0),
              filteredPowerData.map(d => d.solarOutput || 0)
            ),
            totalLoad: calculateCorrelation(
              filteredEnvData.map(d => d[factor] || 0),
              filteredPowerData.map(d => d.totalLoad || 0)
            )
          };
        }
        
        // Generate insights based on correlations
        const insights = [];
        
        for (const factor of factors) {
          const solarCorrelation = correlations[factor].solarOutput;
          if (Math.abs(solarCorrelation) > 0.7) {
            insights.push({
              factor,
              target: 'solarOutput',
              correlation: solarCorrelation,
              strength: Math.abs(solarCorrelation) > 0.9 ? 'strong' : 'moderate',
              relationship: solarCorrelation > 0 ? 'positive' : 'negative',
              message: \`\${formatFactorName(factor)} has a \${solarCorrelation > 0 ? 'positive' : 'negative'} \${Math.abs(solarCorrelation) > 0.9 ? 'strong' : 'moderate'} correlation (\${solarCorrelation.toFixed(2)}) with solar output\`
            });
          }
          
          const loadCorrelation = correlations[factor].totalLoad;
          if (Math.abs(loadCorrelation) > 0.7) {
            insights.push({
              factor,
              target: 'totalLoad',
              correlation: loadCorrelation,
              strength: Math.abs(loadCorrelation) > 0.9 ? 'strong' : 'moderate',
              relationship: loadCorrelation > 0 ? 'positive' : 'negative',
              message: \`\${formatFactorName(factor)} has a \${loadCorrelation > 0 ? 'positive' : 'negative'} \${Math.abs(loadCorrelation) > 0.9 ? 'strong' : 'moderate'} correlation (\${loadCorrelation.toFixed(2)}) with total load\`
            });
          }
        }
        
        return {
          period: {
            start: startDate,
            end: endDate
          },
          dataPoints: Math.min(filteredEnvData.length, filteredPowerData.length),
          correlations,
          insights
        };
      }
      
      // Helper function to calculate correlation coefficient
      function calculateCorrelation(x, y) {
        const n = Math.min(x.length, y.length);
        
        if (n === 0) return 0;
        
        // Ensure arrays are the same length
        const xValues = x.slice(0, n);
        const yValues = y.slice(0, n);
        
        // Calculate means
        const xMean = xValues.reduce((a, b) => a + b, 0) / n;
        const yMean = yValues.reduce((a, b) => a + b, 0) / n;
        
        // Calculate numerator and denominator
        let numerator = 0;
        let xDenom = 0;
        let yDenom = 0;
        
        for (let i = 0; i < n; i++) {
          const xDiff = xValues[i] - xMean;
          const yDiff = yValues[i] - yMean;
          
          numerator += xDiff * yDiff;
          xDenom += xDiff * xDiff;
          yDenom += yDiff * yDiff;
        }
        
        // Avoid division by zero
        if (xDenom === 0 || yDenom === 0) return 0;
        
        return numerator / Math.sqrt(xDenom * yDenom);
      }
      
      // Format factor name for readability
      function formatFactorName(factor) {
        const mapping = {
          'air_temp': 'Air temperature',
          'ghi': 'Global horizontal irradiance',
          'dni': 'Direct normal irradiance',
          'humidity': 'Humidity',
          'windSpeed': 'Wind speed',
          'cloudOpacity': 'Cloud opacity'
        };
        
        return mapping[factor] || factor;
      }
      
      return await correlateEnvironmentalFactors(params, dbUtils);
    `,
    isBuiltIn: true,
    metadata: {
      accessLevel: 'user',
      tags: ['environment', 'correlation', 'analytics']
    }
  });
  
  // Equipment management function - requires manager role
  await UnifiedFunctionRegistry.registerFunction({
    name: 'manageEquipment',
    description: 'Manage equipment settings and maintenance schedules',
    toolType: 'custom',
    metadata: {
      module: 'equipment',
      accessLevel: 'manager',
      returnType: 'EquipmentManagementResult'
    },
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Action to perform (get, update, schedule)',
          enum: ['get', 'update', 'schedule']
        },
        equipmentId: {
          type: 'number',
          description: 'ID of the equipment to manage'
        },
        settings: {
          type: 'object',
          description: 'New settings for the equipment (for update action)'
        },
        maintenanceDate: {
          type: 'string',
          description: 'Date for scheduled maintenance (for schedule action)'
        }
      },
      required: ['action', 'equipmentId']
    },
    returnType: 'object',
    functionCode: `
      async function manageEquipment(params, dbUtils) {
        const { action, equipmentId, settings, maintenanceDate } = params;
        
        // Get equipment
        const equipment = await dbUtils.select('equipment', { id: equipmentId });
        
        if (equipment.length === 0) {
          throw new Error(\`Equipment with ID \${equipmentId} not found\`);
        }
        
        const item = equipment[0];
        
        switch (action) {
          case 'get':
            return {
              action: 'get',
              equipment: item
            };
            
          case 'update':
            if (!settings) {
              throw new Error('Settings are required for update action');
            }
            
            // Update equipment settings
            const updatedEquipment = await dbUtils.update('equipment', {
              ...settings,
              updatedAt: new Date()
            }, { id: equipmentId });
            
            return {
              action: 'update',
              previousSettings: item,
              newSettings: updatedEquipment
            };
            
          case 'schedule':
            if (!maintenanceDate) {
              throw new Error('Maintenance date is required for schedule action');
            }
            
            // Schedule maintenance
            const maintenanceTask = await dbUtils.insert('langchain_agent_tasks', {
              title: \`Maintenance for \${item.name}\`,
              description: \`Scheduled maintenance for equipment: \${item.name} (ID: \${item.id})\`,
              status: 'scheduled',
              type: 'maintenance',
              priority: 'medium',
              scheduledFor: new Date(maintenanceDate),
              parameters: {
                equipmentId: item.id,
                equipmentName: item.name,
                equipmentType: item.type
              }
            });
            
            return {
              action: 'schedule',
              equipment: item,
              maintenanceTask
            };
            
          default:
            throw new Error(\`Unknown action: \${action}\`);
        }
      }
      
      return await manageEquipment(params, dbUtils);
    `,
    isBuiltIn: true,
    metadata: {
      accessLevel: 'manager',
      tags: ['equipment', 'maintenance', 'management']
    }
  });
  
  // System access function - requires admin role
  await UnifiedFunctionRegistry.registerFunction({
    name: 'systemDiagnostics',
    description: 'Run system diagnostics and perform administrative tasks',
    toolType: 'custom',
    metadata: {
      module: 'admin',
      accessLevel: 'admin',
      returnType: 'SystemDiagnosticsResult'
    },
    parameters: {
      type: 'object',
      properties: {
        diagnosticType: {
          type: 'string',
          description: 'Type of diagnostic to run',
          enum: ['database', 'performance', 'security', 'logs']
        },
        timespan: {
          type: 'string',
          description: 'Timespan for the diagnostic',
          enum: ['hour', 'day', 'week', 'month']
        }
      },
      required: ['diagnosticType']
    },
    returnType: 'object',
    functionCode: `
      async function systemDiagnostics(params, dbUtils) {
        const { diagnosticType, timespan = 'day' } = params;
        
        // Calculate the start time based on timespan
        const now = new Date();
        let startTime = new Date(now);
        
        switch (timespan) {
          case 'hour':
            startTime.setHours(now.getHours() - 1);
            break;
          case 'day':
            startTime.setDate(now.getDate() - 1);
            break;
          case 'week':
            startTime.setDate(now.getDate() - 7);
            break;
          case 'month':
            startTime.setMonth(now.getMonth() - 1);
            break;
        }
        
        // Run the appropriate diagnostic
        switch (diagnosticType) {
          case 'database': {
            // Check database statistics
            const tables = ['power_data', 'environmental_data', 'equipment', 'users', 'langchain_agent_conversations', 'langchain_agent_messages'];
            const stats = {};
            
            for (const table of tables) {
              const count = await dbUtils.executeRaw(\`SELECT COUNT(*) as count FROM "\${table}"\`);
              const size = await dbUtils.executeRaw(\`
                SELECT pg_size_pretty(pg_total_relation_size('\${table}')) as size,
                pg_total_relation_size('\${table}') as bytes
              \`);
              
              stats[table] = {
                count: count[0].count,
                size: size[0].size,
                bytes: size[0].bytes
              };
            }
            
            // Get recent data counts
            const recentDataCounts = {};
            for (const table of ['power_data', 'environmental_data']) {
              const recentCount = await dbUtils.executeRaw(\`
                SELECT COUNT(*) as count FROM "\${table}"
                WHERE timestamp >= $1
              \`, [startTime]);
              
              recentDataCounts[table] = recentCount[0].count;
            }
            
            return {
              diagnosticType: 'database',
              timespan,
              timestamp: now.toISOString(),
              tableStats: stats,
              recentData: recentDataCounts,
              totalDatabaseSize: Object.values(stats).reduce((sum, stat) => sum + parseInt(stat.bytes), 0)
            };
          }
          
          case 'performance': {
            // Get performance metrics
            const queryTimes = await dbUtils.executeRaw(\`
              SELECT query, calls, total_time, mean_time
              FROM pg_stat_statements
              ORDER BY total_time DESC
              LIMIT 10
            \`);
            
            // Check for long-running queries
            const longQueries = await dbUtils.executeRaw(\`
              SELECT pid, now() - query_start as duration, query
              FROM pg_stat_activity
              WHERE state = 'active'
              AND now() - query_start > interval '5 seconds'
              ORDER BY duration DESC
            \`);
            
            return {
              diagnosticType: 'performance',
              timespan,
              timestamp: now.toISOString(),
              topQueries: queryTimes,
              longRunningQueries: longQueries,
              connectionCount: (await dbUtils.executeRaw(\`
                SELECT count(*) as count FROM pg_stat_activity
              \`))[0].count
            };
          }
          
          case 'security': {
            // Check recent login attempts
            const loginAttempts = await dbUtils.executeRaw(\`
              SELECT user_id, success, created_at, ip_address
              FROM login_attempts
              WHERE created_at >= $1
              ORDER BY created_at DESC
              LIMIT 100
            \`, [startTime]);
            
            // Count login attempts by success/failure
            const successCount = loginAttempts.filter(a => a.success).length;
            const failureCount = loginAttempts.filter(a => !a.success).length;
            
            // Check for suspicious patterns
            const suspiciousIps = {};
            loginAttempts.forEach(attempt => {
              if (!attempt.success) {
                suspiciousIps[attempt.ip_address] = (suspiciousIps[attempt.ip_address] || 0) + 1;
              }
            });
            
            const suspiciousIpList = Object.entries(suspiciousIps)
              .filter(([_, count]) => count >= 3)
              .map(([ip, count]) => ({ ip, failedAttempts: count }));
            
            return {
              diagnosticType: 'security',
              timespan,
              timestamp: now.toISOString(),
              loginAttempts: {
                success: successCount,
                failure: failureCount,
                total: loginAttempts.length
              },
              suspiciousActivity: suspiciousIpList.length > 0 ? {
                suspiciousIps: suspiciousIpList,
                recommendation: 'Review these IP addresses and consider blocking if unauthorized'
              } : null
            };
          }
          
          case 'logs': {
            // Query application logs
            const logs = await dbUtils.executeRaw(\`
              SELECT id, level, message, timestamp, metadata
              FROM application_logs
              WHERE timestamp >= $1
              ORDER BY timestamp DESC
              LIMIT 100
            \`, [startTime]);
            
            // Count logs by level
            const logCounts = {
              error: logs.filter(log => log.level === 'error').length,
              warn: logs.filter(log => log.level === 'warn').length,
              info: logs.filter(log => log.level === 'info').length,
              debug: logs.filter(log => log.level === 'debug').length
            };
            
            // Get most frequent errors
            const errorMessages = {};
            logs.filter(log => log.level === 'error').forEach(log => {
              const message = log.message;
              errorMessages[message] = (errorMessages[message] || 0) + 1;
            });
            
            const frequentErrors = Object.entries(errorMessages)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([message, count]) => ({ message, count }));
            
            return {
              diagnosticType: 'logs',
              timespan,
              timestamp: now.toISOString(),
              logCounts,
              totalLogs: logs.length,
              frequentErrors
            };
          }
          
          default:
            throw new Error(\`Unknown diagnostic type: \${diagnosticType}\`);
        }
      }
      
      return await systemDiagnostics(params, dbUtils);
    `,
    isBuiltIn: true,
    metadata: {
      accessLevel: 'admin',
      tags: ['admin', 'diagnostics', 'system']
    }
  });
}