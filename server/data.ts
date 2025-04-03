import { InsertPowerData, InsertEnvironmentalData } from "@shared/schema";

// Generate synthetic data based on scenario profiles and actual data ranges
// Customized for southwest Kerry, Ireland in early April
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
  
  // Calculate wind speed with typical Kerry coastal patterns
  const getKerryWindSpeed = (isStormy: boolean = false): number => {
    // Kerry typically has higher wind speeds due to Atlantic coastal location
    if (isStormy) {
      return getRandomInRange(15, 30); // Storm conditions in km/h
    } else {
      return getRandomInRange(5, 18); // Normal conditions in km/h
    }
  };

  // Calculate humidity typical for Irish coastal climate
  const getKerryHumidity = (weather: string): number => {
    switch(weather) {
      case 'Rain':
      case 'Heavy Rain':
        return getRandomInRange(85, 95);
      case 'Drizzle':
      case 'Cloudy':
        return getRandomInRange(75, 90);
      case 'Partly Cloudy': 
        return getRandomInRange(65, 85);
      case 'Sunny':
      case 'Clear':
        return getRandomInRange(60, 80);
      default:
        return getRandomInRange(70, 90);
    }
  };
  
  switch (scenario) {
    case 'sunny':
      // Sunny day in southwest Kerry (rare but happens in April)
      powerData = {
        timestamp: now,
        mainGridPower: getRandomInRange(8, 10),  // Low grid import due to good solar
        solarOutput: getRandomInRange(2.5, 3.5),  // Moderate solar generation for Irish spring
        refrigerationLoad: getRandomInRange(13, 15),
        bigColdRoom: getRandomInRange(6, 8),
        bigFreezer: getRandomInRange(6.5, 7.5),
        smoker: getRandomInRange(0.1, 0.12),
        totalLoad: getRandomInRange(18, 20),
        unaccountedLoad: getRandomInRange(1.5, 2.5)
      };
      
      environmentalData = {
        timestamp: now,
        weather: 'Sunny',
        temperature: getRandomInRange(10, 14),  // Typical April sunny day in Kerry
        humidity: getKerryHumidity('Sunny'),
        windSpeed: getKerryWindSpeed(),
        sunIntensity: getRandomInRange(60, 75)  // Lower than summer but good for April
      };
      break;
      
    case 'cloudy':
      // Cloudy day - common in Kerry
      powerData = {
        timestamp: now,
        mainGridPower: getRandomInRange(12, 14),  // Higher grid import due to low solar
        solarOutput: getRandomInRange(0.8, 1.5),  // Low solar generation
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
        temperature: getRandomInRange(8, 12),  // Typical April cloudy day in Kerry
        humidity: getKerryHumidity('Cloudy'),
        windSpeed: getKerryWindSpeed(),
        sunIntensity: getRandomInRange(15, 30)  // Low sun intensity due to cloud cover
      };
      break;
      
    case 'peak':
      // Peak load scenario with typical mixed Kerry weather
      powerData = {
        timestamp: now,
        mainGridPower: getRandomInRange(15, 17),  // Very high grid import
        solarOutput: getRandomInRange(1.5, 2.5),  // Medium-low solar generation
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
        temperature: getRandomInRange(9, 13),  // Typical April mixed day in Kerry
        humidity: getKerryHumidity('Partly Cloudy'),
        windSpeed: getKerryWindSpeed(),
        sunIntensity: getRandomInRange(35, 55)  // Moderate sun with frequent cloud passing
      };
      break;
      
    case 'night':
      // Night operation - Kerry nights are cool year-round
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
        weather: Math.random() > 0.6 ? 'Clear' : 'Cloudy',  // Mix of clear and cloudy nights
        temperature: getRandomInRange(4, 8),  // Cold April nights in Kerry
        humidity: getKerryHumidity('Clear'),
        windSpeed: getRandomInRange(3, 12),  // Typically lower wind at night
        sunIntensity: 0  // No sun at night
      };
      break;
      
    case 'rain':
      // Rainy day - very common in Kerry!
      powerData = {
        timestamp: now,
        mainGridPower: getRandomInRange(13, 15),  // High grid import due to minimal solar
        solarOutput: getRandomInRange(0.3, 1.0),  // Very low solar generation
        refrigerationLoad: getRandomInRange(13, 15),
        bigColdRoom: getRandomInRange(5, 7),
        bigFreezer: getRandomInRange(6, 7),
        smoker: getRandomInRange(0.1, 0.12),
        totalLoad: getRandomInRange(17, 19),
        unaccountedLoad: getRandomInRange(1.8, 2.8)
      };
      
      environmentalData = {
        timestamp: now,
        weather: Math.random() > 0.5 ? 'Rain' : 'Drizzle',  // Mix of rain and drizzle
        temperature: getRandomInRange(7, 11),  // Cool rainy day
        humidity: getKerryHumidity('Rain'),
        windSpeed: getKerryWindSpeed(Math.random() > 0.7),  // Sometimes stormy
        sunIntensity: getRandomInRange(5, 15)  // Very low sun intensity in rain
      };
      break;
      
    default:
      // Default to a random realistic Kerry weather scenario
      const kerryWeatherScenarios = ['cloudy', 'rain', 'rain', 'cloudy', 'partly_cloudy', 'sunny']; // Weighted for realism
      const randomScenario = kerryWeatherScenarios[Math.floor(Math.random() * kerryWeatherScenarios.length)];
      return generateSyntheticData(randomScenario === 'partly_cloudy' ? 'peak' : randomScenario);
  }
  
  // Ensure totalLoad is at least the sum of the main components
  const minTotal = powerData.mainGridPower + powerData.solarOutput;
  if (powerData.totalLoad < minTotal) {
    powerData.totalLoad = minTotal + getRandomInRange(0.5, 1.5);
  }
  
  return { powerData, environmentalData };
}
