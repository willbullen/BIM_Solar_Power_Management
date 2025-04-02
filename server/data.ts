import { InsertPowerData, InsertEnvironmentalData } from "@shared/schema";

// Generate synthetic data based on scenario profiles
export function generateSyntheticData(
  scenario: string
): { powerData: InsertPowerData, environmentalData: InsertEnvironmentalData } {
  const now = new Date();
  let powerData: InsertPowerData;
  let environmentalData: InsertEnvironmentalData;
  
  switch (scenario) {
    case 'sunny':
      // Sunny day with high solar output
      powerData = {
        timestamp: now,
        mainGridPower: 1.8 + (Math.random() * 0.4),  // Low grid import due to high solar
        solarOutput: 4.2 + (Math.random() * 0.6),    // High solar generation
        refrigerationLoad: 3.8 + (Math.random() * 0.4), 
        bigColdRoom: 9.6 + (Math.random() * 0.4),
        bigFreezer: 7.0 + (Math.random() * 0.4),
        smoker: 0.1 + (Math.random() * 0.05),
        totalLoad: 5.5 + (Math.random() * 0.5),
        unaccountedLoad: 0.5 + (Math.random() * 0.1)
      };
      
      environmentalData = {
        timestamp: now,
        weather: 'Sunny',
        temperature: 24 + (Math.random() * 3),
        sunIntensity: 85 + (Math.random() * 15)
      };
      break;
      
    case 'cloudy':
      // Cloudy day with low solar output
      powerData = {
        timestamp: now,
        mainGridPower: 4.5 + (Math.random() * 0.6),  // High grid import due to low solar
        solarOutput: 1.2 + (Math.random() * 0.4),    // Low solar generation
        refrigerationLoad: 3.7 + (Math.random() * 0.4),
        bigColdRoom: 9.5 + (Math.random() * 0.4),
        bigFreezer: 7.1 + (Math.random() * 0.4),
        smoker: 0.1 + (Math.random() * 0.05),
        totalLoad: 5.6 + (Math.random() * 0.5),
        unaccountedLoad: 0.6 + (Math.random() * 0.1)
      };
      
      environmentalData = {
        timestamp: now,
        weather: 'Cloudy',
        temperature: 18 + (Math.random() * 2),
        sunIntensity: 25 + (Math.random() * 15)
      };
      break;
      
    case 'peak':
      // Peak load scenario with all systems running
      powerData = {
        timestamp: now,
        mainGridPower: 6.2 + (Math.random() * 0.8),  // Very high grid import
        solarOutput: 2.8 + (Math.random() * 0.4),    // Medium solar generation
        refrigerationLoad: 5.1 + (Math.random() * 0.5),
        bigColdRoom: 12.5 + (Math.random() * 0.5),
        bigFreezer: 9.2 + (Math.random() * 0.4),
        smoker: 1.5 + (Math.random() * 0.3),
        totalLoad: 8.9 + (Math.random() * 0.7),
        unaccountedLoad: 0.9 + (Math.random() * 0.2)
      };
      
      environmentalData = {
        timestamp: now,
        weather: 'Partly Cloudy',
        temperature: 22 + (Math.random() * 3),
        sunIntensity: 60 + (Math.random() * 20)
      };
      break;
      
    case 'night':
      // Night operation with no solar
      powerData = {
        timestamp: now,
        mainGridPower: 3.9 + (Math.random() * 0.4),  // Medium grid import
        solarOutput: 0,                              // No solar at night
        refrigerationLoad: 3.5 + (Math.random() * 0.3),
        bigColdRoom: 9.4 + (Math.random() * 0.3),
        bigFreezer: 7.0 + (Math.random() * 0.3),
        smoker: 0.01 + (Math.random() * 0.01),       // Almost no smoker activity at night
        totalLoad: 3.9 + (Math.random() * 0.3),      // Lower total load at night
        unaccountedLoad: 0.3 + (Math.random() * 0.1)
      };
      
      environmentalData = {
        timestamp: now,
        weather: 'Clear',
        temperature: 15 + (Math.random() * 2),
        sunIntensity: 0                             // No sun at night
      };
      break;
      
    default:
      // Default to sunny scenario if unknown
      return generateSyntheticData('sunny');
  }
  
  return { powerData, environmentalData };
}
