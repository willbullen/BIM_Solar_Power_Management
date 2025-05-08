import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL_NAME = "gpt-4o";

export class AIService {
  private openai: OpenAI;
  
  constructor() {
    // Initialize OpenAI client
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  
  /**
   * Generate energy efficiency recommendations based on power and environmental data
   */
  async generateEnergyRecommendations(data: any): Promise<any> {
    try {
      // Format the data for better analysis
      const formattedData = this.formatDataForAnalysis(data);
      
      // Create system message with context
      const systemMessage = `
        You are an advanced energy efficiency advisor for a seafood processing facility called "Emporium".
        Your task is to analyze the provided energy consumption data and environmental conditions to generate actionable recommendations.
        
        The facility has the following main energy consumers:
        - Refrigeration systems (including cold rooms and freezers)
        - Smoker equipment
        - General facility operations
        
        The facility also has solar power generation capabilities.
        
        Your recommendations should be practical, specific, and categorized by:
        1. Impact level (high, medium, low)
        2. Implementation timeline (immediate, scheduled, strategic)
        3. Potential energy savings percentage
        
        Return exactly 3-5 recommendations formatted as a JSON array with the following structure:
        [
          {
            "title": "Short descriptive title",
            "description": "Detailed explanation with specific actions",
            "impact": "high|medium|low",
            "category": "immediate|scheduled|strategic",
            "savings": "X-Y% (estimated range)"
          }
        ]
      `;
      
      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: JSON.stringify(formattedData) }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      
      // Parse and return the AI response
      const content = response.choices[0].message.content;
      return JSON.parse(content || '{"recommendations": []}');
    } catch (error) {
      console.error("Error generating energy recommendations:", error);
      throw error;
    }
  }

  /**
   * Generate advanced analytics based on power and environmental data
   */
  async generateDataAnalytics(data: any): Promise<any> {
    try {
      // Format the data for analytics
      const formattedData = this.formatDataForAnalysis(data);
      
      // Create system message with analytics context
      const systemMessage = `
        You are an advanced energy data analyst for the Emporium seafood processing facility.
        Your task is to analyze the provided energy consumption and environmental data to generate
        actionable insights, detect patterns, and identify correlations and anomalies.
        
        Based on the data, provide the following analyses:
        1. Key performance indicators with current values and trends
        2. Pattern detection including cyclical patterns, anomalies, and correlations
        3. Energy efficiency metrics with detailed explanations
        4. Environmental impact analysis
        
        Return your analysis as a JSON object with the following structure:
        {
          "summary": "Brief executive summary of the overall data analysis",
          "keyInsights": [
            {
              "title": "Insight title",
              "description": "Detailed explanation",
              "significance": "high|medium|low",
              "trend": "improving|stable|declining"
            }
          ],
          "patterns": [
            {
              "name": "Pattern name",
              "description": "Pattern description",
              "impact": "Description of impact"
            }
          ],
          "anomalies": [
            {
              "description": "Anomaly description",
              "possibleCauses": ["Cause 1", "Cause 2"],
              "recommendedActions": ["Action 1", "Action 2"]
            }
          ],
          "efficiencyScore": {
            "overall": 0-100, 
            "components": {
              "solar": 0-100,
              "grid": 0-100,
              "refrigeration": 0-100
            },
            "explanation": "Explanation of efficiency score calculation"
          }
        }
      `;
      
      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: JSON.stringify(formattedData) }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      
      // Parse and return the AI response
      const content = response.choices[0].message.content;
      return JSON.parse(content || '{"summary": "Unable to generate analytics"}');
    } catch (error) {
      console.error("Error generating data analytics:", error);
      throw error;
    }
  }

  /**
   * Generate an executive report based on power and environmental data
   */
  async generateExecutiveReport(data: any, reportType: string): Promise<any> {
    try {
      // Format the data for report generation
      const formattedData = this.formatDataForAnalysis(data);
      
      // Create system message with report context based on type
      let systemMessage = `
        You are an advanced energy reporting system for the Emporium seafood processing facility.
        Your task is to generate a comprehensive executive report based on the provided energy 
        consumption and environmental data.
      `;
      
      // Customize based on report type
      switch (reportType) {
        case 'daily':
          systemMessage += `
            Generate a daily executive summary report that highlights:
            - Today's key performance metrics compared to yesterday
            - Notable events or anomalies
            - Daily energy consumption breakdown
            - Weather impact on energy usage and solar generation
            - Short-term recommendations for the next 24 hours
          `;
          break;
          
        case 'weekly':
          systemMessage += `
            Generate a weekly executive summary report that highlights:
            - Week-over-week performance metrics and trends
            - Patterns observed throughout the week
            - Weekly energy consumption breakdown with daily comparisons
            - Weather patterns and their impact on energy usage
            - Equipment efficiency analysis
            - Recommendations for the coming week
          `;
          break;
          
        case 'monthly':
          systemMessage += `
            Generate a monthly executive summary report that highlights:
            - Month-over-month performance metrics and trends
            - Long-term patterns and seasonal adjustments
            - Monthly energy consumption breakdown with weekly comparisons
            - Cost analysis and savings opportunities
            - Environmental impact assessment
            - Strategic recommendations for the coming month
          `;
          break;
          
        default: // custom
          systemMessage += `
            Generate a comprehensive executive summary report that highlights:
            - Key performance metrics
            - Notable patterns and trends
            - Energy consumption breakdown
            - Efficiency analysis
            - Environmental impact
            - Strategic recommendations
          `;
      }
      
      systemMessage += `
        Return your report as a JSON object with the following structure:
        {
          "title": "Report title",
          "generatedAt": "Current timestamp in ISO format",
          "period": "Description of the period covered",
          "executiveSummary": "Brief executive summary of the overall report",
          "keyMetrics": [
            {
              "name": "Metric name",
              "value": "Current value",
              "change": "Change compared to previous period (with %)",
              "trend": "improving|stable|declining",
              "interpretation": "Brief interpretation"
            }
          ],
          "sections": [
            {
              "title": "Section title",
              "content": "Detailed analysis for this section",
              "charts": [
                {
                  "title": "Chart title",
                  "description": "What this chart would show",
                  "type": "line|bar|pie",
                  "interpretation": "Interpretation of the data visualization"
                }
              ]
            }
          ],
          "recommendations": [
            {
              "title": "Recommendation title",
              "description": "Detailed explanation",
              "priority": "high|medium|low",
              "impact": "Description of expected impact"
            }
          ],
          "conclusion": "Overall conclusion and next steps"
        }
      `;
      
      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: JSON.stringify(formattedData) }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      
      // Parse and return the AI response
      const content = response.choices[0].message.content;
      return JSON.parse(content || '{"title": "Report generation failed", "executiveSummary": "Unable to generate report"}');
    } catch (error) {
      console.error("Error generating executive report:", error);
      throw error;
    }
  }

  /**
   * Generate future usage predictions based on historical data
   */
  async generatePredictions(data: any, forecastHorizon: string): Promise<any> {
    try {
      // Format the data for predictions
      const formattedData = this.formatDataForAnalysis(data);
      
      // Add forecast horizon to the data
      formattedData.forecastHorizon = forecastHorizon;
      
      // Create system message with prediction context
      const systemMessage = `
        You are an advanced energy prediction model for the Emporium seafood processing facility.
        Your task is to analyze the provided historical energy consumption and environmental data 
        to generate predictions for future energy usage and potential solar generation.
        
        Based on the data and the requested forecast horizon (day, week, month), provide predictions for:
        1. Total energy consumption with confidence intervals
        2. Solar generation potential
        3. Grid energy requirements
        4. Load distribution across major systems
        5. Potential weather impacts
        
        Return your predictions as a JSON object with the following structure:
        {
          "forecastPeriod": "Description of the forecast period",
          "generatedAt": "Current timestamp in ISO format",
          "summary": "Brief summary of the overall prediction",
          "predictions": {
            "totalConsumption": {
              "expected": "Predicted value (kWh)",
              "lowRange": "Lower bound (kWh)",
              "highRange": "Upper bound (kWh)",
              "changeFromCurrentPeriod": "% change",
              "confidence": 0-100
            },
            "solarGeneration": {
              "expected": "Predicted value (kWh)",
              "factors": ["Factor 1", "Factor 2"],
              "confidence": 0-100
            },
            "gridRequirements": {
              "expected": "Predicted value (kWh)",
              "peak": "Predicted peak demand (kW)",
              "confidence": 0-100
            },
            "loadDistribution": {
              "refrigeration": "Percentage of total",
              "smoker": "Percentage of total",
              "other": "Percentage of total"
            }
          },
          "weatherImpact": {
            "description": "Brief description of weather impact",
            "significance": "high|medium|low"
          },
          "timeSeriesForecasts": [
            {
              "timestamp": "ISO timestamp",
              "totalLoad": "Predicted value",
              "solarOutput": "Predicted value",
              "gridPower": "Predicted value"
            }
          ]
        }
      `;
      
      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: JSON.stringify(formattedData) }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      
      // Parse and return the AI response
      const content = response.choices[0].message.content;
      return JSON.parse(content || '{"summary": "Unable to generate predictions"}');
    } catch (error) {
      console.error("Error generating predictions:", error);
      throw error;
    }
  }
  
  /**
   * Format data for better analysis by the AI
   */
  private formatDataForAnalysis(data: any): any {
    // Extract the current state
    const currentState = {
      currentPower: data.currentPower || {},
      environmentalData: data.environmentalData || {},
    };
    
    // Extract trends from historical data
    let trends = {};
    if (data.powerTrend && data.powerTrend.length > 0) {
      // Calculate averages, peaks, and patterns
      const totalLoads = data.powerTrend.map((item: any) => item.totalLoad);
      const mainGridUsage = data.powerTrend.map((item: any) => item.mainGridPower);
      const solarOutputs = data.powerTrend.map((item: any) => item.solarOutput);
      
      const avgTotalLoad = this.calculateAverage(totalLoads);
      const avgMainGrid = this.calculateAverage(mainGridUsage);
      const avgSolarOutput = this.calculateAverage(solarOutputs);
      const peakTotalLoad = Math.max(...totalLoads);
      const minTotalLoad = Math.min(...totalLoads);
      
      // Calculate load patterns
      const loadVariation = this.calculateStandardDeviation(totalLoads);
      const solarVariation = this.calculateStandardDeviation(solarOutputs);
      
      trends = {
        averageTotalLoad: avgTotalLoad,
        averageMainGridUsage: avgMainGrid,
        averageSolarOutput: avgSolarOutput,
        peakLoad: peakTotalLoad,
        minLoad: minTotalLoad,
        loadVariationIndex: loadVariation / avgTotalLoad, // Normalized standard deviation
        solarVariationIndex: solarVariation / (avgSolarOutput || 1), // Avoid division by zero
        dataPoints: data.powerTrend.length,
      };
    }
    
    // Calculate efficiency metrics
    const efficiencyMetrics = this.calculateEfficiencyMetrics(data);
    
    return {
      currentState,
      trends,
      efficiencyMetrics,
      powerTrend: data.powerTrend || [],
      environmentalTrend: data.environmentalTrend || [],
      rawDataSample: data.powerTrend?.slice(0, 3) || []
    };
  }
  
  /**
   * Calculate average of an array of numbers
   */
  private calculateAverage(values: number[]): number {
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, val) => sum + (val || 0), 0) / values.length;
  }
  
  /**
   * Calculate standard deviation of an array of numbers
   */
  private calculateStandardDeviation(values: number[]): number {
    if (!values || values.length <= 1) return 0;
    
    const avg = this.calculateAverage(values);
    const squareDiffs = values.map(value => {
      const diff = value - avg;
      return diff * diff;
    });
    
    const avgSquareDiff = this.calculateAverage(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }
  
  /**
   * Calculate efficiency metrics from the data
   */
  private calculateEfficiencyMetrics(data: any): any {
    const metrics: any = {};
    
    // Calculate solar utilization ratio if data is available
    if (data.currentPower?.solarOutput && data.currentPower?.totalLoad) {
      metrics.solarUtilizationRatio = data.currentPower.solarOutput / data.currentPower.totalLoad;
    }
    
    // Calculate refrigeration efficiency
    if (data.currentPower?.refrigerationLoad && 
        data.currentPower?.bigColdRoom && 
        data.currentPower?.bigFreezer) {
      
      metrics.refrigerationTotal = data.currentPower.refrigerationLoad;
      metrics.coldRoomFreezerRatio = data.currentPower.bigColdRoom / 
                                    (data.currentPower.bigFreezer || 1); // Avoid division by zero
    }
    
    // Calculate energy distribution
    if (data.currentPower?.totalLoad) {
      const totalLoad = data.currentPower.totalLoad;
      metrics.refrigerationPercentage = (data.currentPower.refrigerationLoad || 0) / totalLoad;
      metrics.smokerPercentage = (data.currentPower.smoker || 0) / totalLoad;
      metrics.unaccountedPercentage = (data.currentPower.unaccountedLoad || 0) / totalLoad;
    }
    
    return metrics;
  }
}