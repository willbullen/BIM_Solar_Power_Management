import * as tf from '@tensorflow/tfjs';
import * as ss from 'simple-statistics';
import { PowerData, EnvironmentalData } from '@shared/schema';

/**
 * Forecasting and anomaly detection utilities for Dalys Seafoods monitoring system
 */

// Type definitions for forecast results
export interface ForecastResult {
  timestamp: Date;
  predictedValue: number;
  lowerBound: number;
  upperBound: number;
  isAnomaly?: boolean;
}

export interface PowerForecast {
  mainGridPower: ForecastResult[];
  solarOutput: ForecastResult[];
  refrigerationLoad: ForecastResult[];
  bigColdRoom: ForecastResult[];
  bigFreezer: ForecastResult[];
  smoker: ForecastResult[];
  totalLoad: ForecastResult[];
}

export interface AnomalyResult {
  timestamp: Date;
  metric: string;
  actualValue: number;
  expectedValue: number;
  deviation: number;
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high';
  possibleCauses: string[];
  recommendedActions: string[];
}

/**
 * Detect anomalies in power data using Z-scores
 * @param data Historical power data
 * @param threshold Z-score threshold for anomaly detection (default: 2.5)
 * @returns Array of anomalies found in the data
 */
export function detectAnomalies(
  data: PowerData[],
  envData: EnvironmentalData[],
  threshold = 2.5
): AnomalyResult[] {
  if (!data.length) return [];
  
  const anomalies: AnomalyResult[] = [];
  
  // Get the metrics to analyze
  const metrics = [
    'mainGridPower', 
    'solarOutput', 
    'refrigerationLoad', 
    'bigColdRoom', 
    'bigFreezer', 
    'smoker', 
    'totalLoad'
  ] as const;
  
  // Process each metric
  metrics.forEach(metric => {
    // Extract values for the metric
    const values = data.map(d => d[metric]);
    
    // Calculate mean and standard deviation
    const mean = ss.mean(values);
    const stdDev = ss.standardDeviation(values);
    
    // For each data point, calculate Z-score and check for anomalies
    data.forEach((d, i) => {
      const value = d[metric];
      const zScore = Math.abs((value - mean) / stdDev);
      
      if (zScore > threshold) {
        // Find closest environmental data to this timestamp
        const closestEnvData = findClosestEnvironmentalData(d.timestamp, envData);
        
        // Determine possible causes and recommendations based on the metric and conditions
        const { causes, actions } = determineAnomalyCausesAndActions(
          metric, 
          value, 
          mean, 
          closestEnvData
        );
        
        // Calculate severity based on z-score
        let severity: 'low' | 'medium' | 'high' = 'low';
        if (zScore > threshold * 1.5) severity = 'medium';
        if (zScore > threshold * 2) severity = 'high';
        
        anomalies.push({
          timestamp: new Date(d.timestamp),
          metric,
          actualValue: value,
          expectedValue: mean,
          deviation: (value - mean) / mean * 100, // Percentage deviation
          isAnomaly: true,
          severity,
          possibleCauses: causes,
          recommendedActions: actions
        });
      }
    });
  });
  
  return anomalies;
}

/**
 * Find the closest environmental data point to a given timestamp
 */
function findClosestEnvironmentalData(timestamp: Date | string, envData: EnvironmentalData[]): EnvironmentalData | null {
  if (!envData.length) return null;
  
  const targetTime = new Date(timestamp).getTime();
  
  return envData.reduce((closest, current) => {
    const currentTime = new Date(current.timestamp).getTime();
    const closestTime = new Date(closest.timestamp).getTime();
    
    return Math.abs(currentTime - targetTime) < Math.abs(closestTime - targetTime)
      ? current
      : closest;
  });
}

/**
 * Determine causes and recommended actions for an anomaly
 */
function determineAnomalyCausesAndActions(
  metric: string, 
  value: number, 
  average: number,
  envData: EnvironmentalData | null
): { causes: string[], actions: string[] } {
  const causes: string[] = [];
  const actions: string[] = [];
  const isHighAnomaly = value > average;
  
  switch (metric) {
    case 'mainGridPower':
      if (isHighAnomaly) {
        causes.push('Unexpected increase in power draw from the grid');
        causes.push('Potential equipment malfunction increasing power consumption');
        if (envData && envData.sunIntensity < 30) {
          causes.push('Low solar output due to weather conditions');
        }
        
        actions.push('Check for malfunctioning equipment drawing excess power');
        actions.push('Verify if new equipment was recently added to the system');
        actions.push('Consider shifting high-power operations to times with better solar conditions');
      } else {
        causes.push('Decrease in operational activity');
        if (envData && envData.sunIntensity > 70) {
          causes.push('High solar output reducing grid dependency');
        }
        
        actions.push('Opportunity to schedule maintenance during this lower usage period');
        actions.push('Consider shifting more operations to this time period');
      }
      break;
      
    case 'solarOutput':
      if (isHighAnomaly) {
        causes.push('Exceptionally favorable solar conditions');
        if (envData) {
          causes.push(`Unusually high sun intensity (${envData.sunIntensity}%)`);
        }
        
        actions.push('Opportunity to run high-power equipment');
        actions.push('Consider storing excess energy if possible');
      } else {
        causes.push('Reduced solar panel efficiency');
        if (envData) {
          if (envData.weather !== 'Sunny') {
            causes.push(`Weather conditions: ${envData.weather}`);
          }
          if (envData.sunIntensity < 40) {
            causes.push(`Low sun intensity (${envData.sunIntensity}%)`);
          }
        }
        
        actions.push('Check for solar panel obstructions or maintenance needs');
        actions.push('Shift high-power operations to grid power until solar improves');
      }
      break;
      
    case 'refrigerationLoad':
      if (isHighAnomaly) {
        causes.push('Increased refrigeration demand');
        if (envData && envData.temperature > 22) {
          causes.push(`Higher ambient temperature (${envData.temperature}°C)`);
        }
        causes.push('Possible door left open or seal issues');
        
        actions.push('Check refrigeration unit doors and seals');
        actions.push('Verify refrigeration system efficiency');
        actions.push('Consider scheduling maintenance for refrigeration units');
      } else {
        causes.push('Decreased refrigeration usage');
        causes.push('Possible temporary shutdown of refrigeration units');
        
        actions.push('Verify refrigeration units are functioning properly');
        actions.push('Opportunity for maintenance if intentional reduction');
      }
      break;
      
    case 'bigColdRoom':
    case 'bigFreezer':
      if (isHighAnomaly) {
        causes.push(`Higher ${metric === 'bigColdRoom' ? 'cold room' : 'freezer'} power usage`);
        causes.push('Possible temperature setpoint change');
        causes.push('Potential door seal issues or frequent access');
        
        actions.push('Check door seals and access patterns');
        actions.push('Verify temperature setpoints');
        actions.push('Consider scheduling maintenance');
      } else {
        causes.push(`Lower ${metric === 'bigColdRoom' ? 'cold room' : 'freezer'} power usage`);
        causes.push('Reduced inventory or improved insulation performance');
        
        actions.push('Verify unit is maintaining required temperature');
      }
      break;
      
    case 'smoker':
      if (isHighAnomaly) {
        causes.push('Smoker operating at higher capacity');
        causes.push('Potential temperature regulation issues');
        
        actions.push('Check smoker temperature controls');
        actions.push('Verify smoker maintenance schedule');
      } else {
        causes.push('Smoker operating at lower capacity');
        causes.push('Smoker potentially in standby mode');
        
        actions.push('Verify smoker functionality if production requires it');
      }
      break;
      
    case 'totalLoad':
      if (isHighAnomaly) {
        causes.push('Overall higher power consumption across the facility');
        causes.push('Possible unaccounted equipment usage');
        
        actions.push('Review all systems for unexpected power usage');
        actions.push('Consider load balancing to off-peak hours');
      } else {
        causes.push('Overall lower power consumption');
        causes.push('Reduced operational activity');
        
        actions.push('Opportunity for maintenance or system upgrades');
      }
      break;
  }
  
  return { causes, actions };
}

/**
 * Generate forecast for the next 24 hours based on historical data
 * @param historicalData Array of historical power data
 * @param hoursToForecast Number of hours to forecast
 * @returns Forecast results for each power metric
 */
export function generatePowerForecast(
  historicalData: PowerData[], 
  environmentalData: EnvironmentalData[],
  hoursToForecast: number = 24
): PowerForecast {
  // Default empty forecast structure
  const emptyForecast: PowerForecast = {
    mainGridPower: [],
    solarOutput: [],
    refrigerationLoad: [],
    bigColdRoom: [],
    bigFreezer: [],
    smoker: [],
    totalLoad: []
  };
  
  if (historicalData.length < 24) {
    console.warn('Insufficient data for accurate forecasting');
    return emptyForecast;
  }
  
  // Get relevant environmental data
  const envData = environmentalData.slice(-historicalData.length);
  
  // Metrics to forecast
  const metrics = [
    'mainGridPower', 
    'solarOutput', 
    'refrigerationLoad', 
    'bigColdRoom', 
    'bigFreezer', 
    'smoker', 
    'totalLoad'
  ] as const;
  
  // Generate forecast for each metric
  const forecastResults: PowerForecast = emptyForecast;
  
  metrics.forEach(metric => {
    forecastResults[metric] = forecastMetric(
      historicalData,
      envData,
      metric,
      hoursToForecast
    );
  });
  
  return forecastResults;
}

/**
 * Generate a forecast for a specific power metric
 */
function forecastMetric(
  historicalData: PowerData[], 
  envData: EnvironmentalData[],
  metric: keyof PowerForecast, 
  hoursToForecast: number
): ForecastResult[] {
  // Extract the values for the metric
  const values = historicalData.map(d => d[metric]);
  const timestamps = historicalData.map(d => new Date(d.timestamp).getTime());
  
  // Create features array - we'll use:
  // 1. Hour of day (0-23) - important for capturing daily patterns
  // 2. Day of week (0-6) - important for weekly patterns
  // 3. Temperature (if available) - important for refrigeration loads
  // 4. Sun intensity (if available) - important for solar output
  const features: number[][] = [];
  
  historicalData.forEach((data, i) => {
    const date = new Date(data.timestamp);
    const hourOfDay = date.getHours();
    const dayOfWeek = date.getDay();
    
    // Find closest environmental data
    const env = i < envData.length ? envData[i] : null;
    const temperature = env ? env.temperature : 20; // Default temperature if unavailable
    const sunIntensity = env ? env.sunIntensity : 50; // Default sun intensity if unavailable
    
    features.push([hourOfDay, dayOfWeek, temperature, sunIntensity]);
  });
  
  // Train a linear regression model
  const model = trainForecastModel(features, values);
  
  // Generate future timestamps and features
  const forecast: ForecastResult[] = [];
  const lastTimestamp = new Date(historicalData[historicalData.length - 1].timestamp);
  
  for (let hour = 1; hour <= hoursToForecast; hour++) {
    const forecastTimestamp = new Date(lastTimestamp);
    forecastTimestamp.setHours(forecastTimestamp.getHours() + hour);
    
    const hourOfDay = forecastTimestamp.getHours();
    const dayOfWeek = forecastTimestamp.getDay();
    
    // Estimate environmental conditions based on time patterns
    // This is a simplified approach - in a real system we would use weather forecasts
    const temperature = estimateTemperature(hourOfDay, dayOfWeek, envData);
    const sunIntensity = estimateSunIntensity(hourOfDay, dayOfWeek, envData);
    
    // Make prediction using the trained model
    const predictedValue = predictValue(model, [hourOfDay, dayOfWeek, temperature, sunIntensity]);
    
    // Calculate confidence intervals (simplified approach)
    const std = ss.standardDeviation(values);
    const marginOfError = 1.96 * std / Math.sqrt(values.length);
    
    forecast.push({
      timestamp: forecastTimestamp,
      predictedValue: Math.max(0, predictedValue), // Ensure no negative predictions
      lowerBound: Math.max(0, predictedValue - marginOfError),
      upperBound: predictedValue + marginOfError
    });
  }
  
  return forecast;
}

/**
 * Train a simple regression model for forecasting
 */
function trainForecastModel(features: number[][], values: number[]): any {
  // For simplicity, we'll use a linear regression approach
  // In a production system, we might use more sophisticated models or TensorFlow
  
  // Calculate coefficient for each feature
  const coefficients: number[] = [];
  const meanValue = ss.mean(values);
  
  // For each feature, calculate a simple correlation coefficient
  for (let featureIndex = 0; featureIndex < features[0].length; featureIndex++) {
    const featureValues = features.map(f => f[featureIndex]);
    const correlation = ss.sampleCorrelation(featureValues, values);
    coefficients.push(correlation);
  }
  
  // Return a simple model
  return {
    coefficients,
    meanValue,
    features: features[0].length
  };
}

/**
 * Predict a value using the trained model
 */
function predictValue(model: any, features: number[]): number {
  let prediction = model.meanValue;
  
  // Apply each coefficient to the corresponding feature
  for (let i = 0; i < Math.min(features.length, model.coefficients.length); i++) {
    prediction += features[i] * model.coefficients[i];
  }
  
  return prediction;
}

/**
 * Estimate temperature based on historical patterns
 */
function estimateTemperature(hour: number, day: number, envData: EnvironmentalData[]): number {
  if (!envData.length) return 20;
  
  // Filter environmental data for similar hours and days
  const similarTimeData = envData.filter(data => {
    const dataTime = new Date(data.timestamp);
    return (
      dataTime.getHours() === hour || 
      dataTime.getHours() === (hour + 1) % 24 || 
      dataTime.getHours() === (hour - 1 + 24) % 24
    ) && (
      dataTime.getDay() === day ||
      dataTime.getDay() === (day + 1) % 7 ||
      dataTime.getDay() === (day - 1 + 7) % 7
    );
  });
  
  if (similarTimeData.length) {
    return ss.mean(similarTimeData.map(d => d.temperature));
  }
  
  // Fallback to overall average
  return ss.mean(envData.map(d => d.temperature));
}

/**
 * Estimate sun intensity based on historical patterns
 */
function estimateSunIntensity(hour: number, day: number, envData: EnvironmentalData[]): number {
  if (!envData.length) return 50;
  
  // Nighttime hours have zero sun intensity
  if (hour < 6 || hour > 19) return 0;
  
  // Filter environmental data for similar hours and days
  const similarTimeData = envData.filter(data => {
    const dataTime = new Date(data.timestamp);
    return (
      dataTime.getHours() === hour || 
      dataTime.getHours() === (hour + 1) % 24 || 
      dataTime.getHours() === (hour - 1 + 24) % 24
    ) && (
      dataTime.getDay() === day ||
      dataTime.getDay() === (day + 1) % 7 ||
      dataTime.getDay() === (day - 1 + 7) % 7
    );
  });
  
  if (similarTimeData.length) {
    return ss.mean(similarTimeData.map(d => d.sunIntensity));
  }
  
  // Fallback based on time of day (simplified model)
  // Peak sun intensity around noon
  const hourFactor = 1 - Math.abs(hour - 12) / 12;
  return hourFactor * 80; // Max intensity of 80%
}

/**
 * Get energy efficiency recommendations based on historical and forecast data
 */
export function getEfficiencyRecommendations(
  historicalData: PowerData[],
  forecastData: PowerForecast,
  environmentalData: EnvironmentalData[]
): string[] {
  if (!historicalData.length || !environmentalData.length) {
    return ['Insufficient data for efficiency recommendations'];
  }
  
  const recommendations: string[] = [];
  
  // 1. Analyze solar output utilization
  const avgSolarOutput = ss.mean(historicalData.map(d => d.solarOutput));
  const avgMainsUsage = ss.mean(historicalData.map(d => d.mainGridPower));
  const solarRatio = avgSolarOutput / (avgSolarOutput + avgMainsUsage);
  
  if (solarRatio < 0.25) {
    recommendations.push('Consider increasing solar capacity to reduce dependency on grid power');
  }
  
  // 2. Analyze refrigeration efficiency
  const refrigerationData = historicalData.map((d, i) => {
    const env = i < environmentalData.length ? environmentalData[i] : null;
    return {
      load: d.refrigerationLoad + d.bigColdRoom + d.bigFreezer,
      temp: env ? env.temperature : null
    };
  }).filter(d => d.temp !== null);
  
  // Check correlation between temperature and refrigeration load
  if (refrigerationData.length > 10) {
    const temps = refrigerationData.map(d => d.temp as number);
    const loads = refrigerationData.map(d => d.load);
    const correlation = ss.sampleCorrelation(temps, loads);
    
    if (correlation > 0.7) {
      recommendations.push('Refrigeration load strongly correlates with temperature. Consider improving insulation to reduce energy costs.');
    }
  }
  
  // 3. Identify optimal times for energy-intensive operations
  const hourlyPowerUsage: Record<number, number[]> = {};
  const hourlySolarOutput: Record<number, number[]> = {};
  
  historicalData.forEach(d => {
    const hour = new Date(d.timestamp).getHours();
    if (!hourlyPowerUsage[hour]) hourlyPowerUsage[hour] = [];
    if (!hourlySolarOutput[hour]) hourlySolarOutput[hour] = [];
    
    hourlyPowerUsage[hour].push(d.totalLoad);
    hourlySolarOutput[hour].push(d.solarOutput);
  });
  
  // Calculate average power usage and solar output by hour
  const hourlyAverages = Object.keys(hourlyPowerUsage).map(hour => {
    const hourNum = parseInt(hour);
    return {
      hour: hourNum,
      avgUsage: ss.mean(hourlyPowerUsage[hourNum]),
      avgSolar: hourlySolarOutput[hourNum].length ? ss.mean(hourlySolarOutput[hourNum]) : 0
    };
  });
  
  // Find low usage hours and high solar output hours
  const lowUsageHours = hourlyAverages
    .filter(h => h.avgUsage < ss.mean(hourlyAverages.map(h => h.avgUsage)))
    .map(h => h.hour)
    .sort((a, b) => a - b);
    
  const highSolarHours = hourlyAverages
    .filter(h => h.hour >= 8 && h.hour <= 16 && h.avgSolar > 0)
    .sort((a, b) => b.avgSolar - a.avgSolar)
    .map(h => h.hour);
  
  if (lowUsageHours.length) {
    const hourRanges = formatHourRanges(lowUsageHours);
    recommendations.push(`Consider scheduling maintenance during low power usage hours: ${hourRanges}`);
  }
  
  if (highSolarHours.length) {
    const hourRanges = formatHourRanges(highSolarHours);
    recommendations.push(`Schedule energy-intensive operations during peak solar hours: ${hourRanges}`);
  }
  
  // 4. Analyze smoker usage patterns
  const smokerUsage = historicalData.map(d => d.smoker);
  const avgSmokerUsage = ss.mean(smokerUsage);
  
  if (avgSmokerUsage > 0.5) {
    // Check if smoker is used during high energy cost times
    const highUsageHours = hourlyAverages
      .filter(h => h.avgUsage > ss.mean(hourlyAverages.map(h => h.avgUsage)))
      .map(h => h.hour);
      
    const smokerByHour: Record<number, number[]> = {};
    historicalData.forEach(d => {
      const hour = new Date(d.timestamp).getHours();
      if (!smokerByHour[hour]) smokerByHour[hour] = [];
      smokerByHour[hour].push(d.smoker);
    });
    
    const smokerHighUsageHours = Object.keys(smokerByHour)
      .map(hour => parseInt(hour))
      .filter(hour => {
        const avg = ss.mean(smokerByHour[hour]);
        return avg > avgSmokerUsage * 1.2; // 20% above average
      });
      
    const overlap = smokerHighUsageHours.filter(hour => highUsageHours.includes(hour));
    
    if (overlap.length) {
      const hourRanges = formatHourRanges(overlap);
      recommendations.push(`Consider shifting smoker operations away from peak energy usage hours: ${hourRanges}`);
    }
  }
  
  // 5. Predict future high-load periods from forecast
  const highLoadPeriods: Date[] = [];
  
  // Check total load forecast for high values
  if (forecastData.totalLoad.length) {
    const avgForecastLoad = ss.mean(forecastData.totalLoad.map(f => f.predictedValue));
    const highThreshold = avgForecastLoad * 1.2; // 20% above average
    
    forecastData.totalLoad.forEach(forecast => {
      if (forecast.predictedValue > highThreshold) {
        highLoadPeriods.push(forecast.timestamp);
      }
    });
  }
  
  if (highLoadPeriods.length) {
    const formattedPeriods = highLoadPeriods
      .map(date => `${date.toLocaleDateString()} ${date.getHours()}:00-${date.getHours() + 1}:00`)
      .join(', ');
      
    recommendations.push(`Forecast indicates high energy usage during: ${formattedPeriods}. Consider load balancing if possible.`);
  }
  
  return recommendations;
}

/**
 * Format a list of hours into readable time ranges
 */
function formatHourRanges(hours: number[]): string {
  if (!hours.length) return '';
  
  // Sort hours
  const sortedHours = [...hours].sort((a, b) => a - b);
  
  // Group consecutive hours
  const ranges: string[] = [];
  let rangeStart = sortedHours[0];
  let rangeEnd = sortedHours[0];
  
  for (let i = 1; i < sortedHours.length; i++) {
    if (sortedHours[i] === rangeEnd + 1) {
      // Continue the current range
      rangeEnd = sortedHours[i];
    } else {
      // End current range and start a new one
      if (rangeStart === rangeEnd) {
        ranges.push(`${rangeStart}:00`);
      } else {
        ranges.push(`${rangeStart}:00-${rangeEnd + 1}:00`);
      }
      rangeStart = sortedHours[i];
      rangeEnd = sortedHours[i];
    }
  }
  
  // Add the last range
  if (rangeStart === rangeEnd) {
    ranges.push(`${rangeStart}:00`);
  } else {
    ranges.push(`${rangeStart}:00-${rangeEnd + 1}:00`);
  }
  
  return ranges.join(', ');
}