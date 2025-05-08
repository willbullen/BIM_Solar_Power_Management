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