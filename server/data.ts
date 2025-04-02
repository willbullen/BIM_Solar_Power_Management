import { InsertPowerData, InsertEnvironmentalData } from "@shared/schema";

// Generate synthetic data based on scenario profiles and actual data ranges
export function generateSyntheticData(
  scenario: string
): { powerData: InsertPowerData, environmentalData: InsertEnvironmentalData } {
  const now = new Date();
  let powerData: InsertPowerData;
  let environmentalData: InsertEnvironmentalData;
  
  // Helper function to get random value within a range
  const getRandomInRange = (min: number, max: number): number => {
    return min + (Math.random() * (max - min));
  };
  
  switch (scenario) {
    case 'sunny':
      // Sunny day with high solar output - based on actual data ranges
      powerData = {
        timestamp: now,
        mainGridPower: getRandomInRange(8, 10),  // Low grid import due to high solar
        solarOutput: getRandomInRange(3.5, 4.5),  // High solar generation
        refrigerationLoad: getRandomInRange(13, 15),
        bigColdRoom: getRandomInRange(6, 8),
        bigFreezer: getRandomInRange(6.5, 7.5),
        smoker: getRandomInRange(0.1, 0.12),
        totalLoad: getRandomInRange(18, 20),  // Calculated as sum of primary loads
        unaccountedLoad: getRandomInRange(1.5, 2.5)
      };
      
      environmentalData = {
        timestamp: now,
        weather: 'Sunny',
        temperature: getRandomInRange(22, 26),
        sunIntensity: getRandomInRange(80, 95)
      };
      break;
      
    case 'cloudy':
      // Cloudy day with low solar output - based on actual data ranges
      powerData = {
        timestamp: now,
        mainGridPower: getRandomInRange(12, 14),  // High grid import due to low solar
        solarOutput: getRandomInRange(1.0, 2.0),  // Low solar generation
        refrigerationLoad: getRandomInRange(13, 15),
        bigColdRoom: getRandomInRange(5, 7),
        bigFreezer: getRandomInRange(6, 7),
        smoker: getRandomInRange(0.1, 0.12),
        totalLoad: getRandomInRange(17, 19),
        unaccountedLoad: getRandomInRange(1.8, 2.8)
      };
      
      environmentalData = {
        timestamp: now,
        weather: 'Cloudy',
        temperature: getRandomInRange(16, 20),
        sunIntensity: getRandomInRange(20, 40)
      };
      break;
      
    case 'peak':
      // Peak load scenario with all systems running - based on actual data ranges
      powerData = {
        timestamp: now,
        mainGridPower: getRandomInRange(15, 17),  // Very high grid import
        solarOutput: getRandomInRange(2.5, 3.5),  // Medium solar generation
        refrigerationLoad: getRandomInRange(24, 28),
        bigColdRoom: getRandomInRange(8, 9.5),
        bigFreezer: getRandomInRange(8, 9),
        smoker: getRandomInRange(0.11, 0.14),
        totalLoad: getRandomInRange(24, 28),
        unaccountedLoad: getRandomInRange(2.5, 3.5)
      };
      
      environmentalData = {
        timestamp: now,
        weather: 'Partly Cloudy',
        temperature: getRandomInRange(20, 24),
        sunIntensity: getRandomInRange(55, 75)
      };
      break;
      
    case 'night':
      // Night operation with no solar - based on actual data ranges
      powerData = {
        timestamp: now,
        mainGridPower: getRandomInRange(10, 12),  // Medium grid import
        solarOutput: 0,  // No solar at night
        refrigerationLoad: getRandomInRange(12, 14),
        bigColdRoom: getRandomInRange(4, 6),
        bigFreezer: getRandomInRange(5.5, 6.5),
        smoker: getRandomInRange(0.10, 0.11),  // Lower smoker activity at night
        totalLoad: getRandomInRange(14, 16),  // Lower total load at night
        unaccountedLoad: getRandomInRange(1.0, 2.0)
      };
      
      environmentalData = {
        timestamp: now,
        weather: 'Clear',
        temperature: getRandomInRange(13, 17),
        sunIntensity: 0  // No sun at night
      };
      break;
      
    default:
      // Default to sunny scenario if unknown
      return generateSyntheticData('sunny');
  }
  
  // Ensure totalLoad is at least the sum of the main components
  const minTotal = powerData.mainGridPower + powerData.solarOutput;
  if (powerData.totalLoad < minTotal) {
    powerData.totalLoad = minTotal + getRandomInRange(0.5, 1.5);
  }
  
  return { powerData, environmentalData };
}
