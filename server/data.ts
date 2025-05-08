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
  
  // Calculate wind speed with realistic Kerry coastal patterns
  // Kerry has among the highest average wind speeds in Ireland
  const getKerryWindSpeed = (isStormy: boolean = false): number => {
    // Kerry's Atlantic coastal location experiences strong winds
    if (isStormy) {
      return getRandomInRange(22, 40); // Storm conditions in km/h (common in Kerry)
    } else {
      // Kerry averages 17-22 km/h wind speeds year-round
      return getRandomInRange(12, 25); // Normal conditions in km/h
    }
  };

  // Calculate humidity typical for Kerry coastal climate
  // Kerry's microclimate is characterized by high humidity due to Atlantic proximity
  const getKerryHumidity = (weather: string): number => {
    switch(weather) {
      case 'Rain':
      case 'Heavy Rain':
        return getRandomInRange(88, 98); // Kerry rain brings extremely high humidity
      case 'Drizzle': // Very common in Kerry
        return getRandomInRange(85, 95);
      case 'Cloudy': // Most common weather pattern
        return getRandomInRange(80, 92);
      case 'Partly Cloudy': 
        return getRandomInRange(75, 88);
      case 'Sunny':
      case 'Clear': // Rare but happens occasionally
        return getRandomInRange(70, 85); // Even on sunny days, Kerry maintains high humidity
      default:
        return getRandomInRange(80, 95); // Default high humidity for Kerry
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
        air_temp: getRandomInRange(8, 13),  // April sunny day in SW Kerry is mild
        humidity: getKerryHumidity('Sunny'),
        windSpeed: getKerryWindSpeed(),
        // Convert sunIntensity to GHI and DNI for Solcast compatibility
        ghi: getRandomInRange(550, 700), // Global Horizontal Irradiance in W/m²
        dni: getRandomInRange(650, 850)  // Direct Normal Irradiance in W/m²
      };
      break;
      
    case 'cloudy':
      // Cloudy day - very common in Kerry (most frequent weather pattern)
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
        air_temp: getRandomInRange(6, 11),  // Typical April cloudy day in Kerry is cooler
        humidity: getKerryHumidity('Cloudy'),
        windSpeed: getKerryWindSpeed(),  // Kerry's typical wind is strong
        ghi: getRandomInRange(100, 250),  // GHI in W/m² for cloudy conditions
        dni: getRandomInRange(50, 150)    // DNI in W/m² for cloudy conditions
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
        air_temp: getRandomInRange(7, 12),  // Kerry's temperature range is narrower due to coastal influence
        humidity: getKerryHumidity('Partly Cloudy'),
        windSpeed: getKerryWindSpeed(),
        ghi: getRandomInRange(300, 500),  // GHI in W/m² for partly cloudy conditions
        dni: getRandomInRange(250, 450)   // DNI in W/m² for partly cloudy conditions
      };
      break;
      
    case 'night':
      // Night operation - Kerry nights are cool and often misty
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
        weather: Math.random() > 0.3 ? 'Cloudy' : 'Clear',  // More cloudy nights than clear in Kerry
        air_temp: getRandomInRange(2, 7),  // Cold April nights in Kerry
        humidity: getKerryHumidity(Math.random() > 0.3 ? 'Cloudy' : 'Clear'),
        windSpeed: getRandomInRange(8, 15),  // Kerry's wind rarely completely stops
        ghi: 0,  // No solar radiation at night
        dni: 0   // No direct solar radiation at night
      };
      break;
      
    case 'rain':
      // Rainy day - extremely common in Kerry (200+ rain days per year)
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
      
      // Kerry experiences various rain types - heavy Atlantic squalls to persistent drizzle
      const rainType = Math.random();
      const isHeavyRain = rainType < 0.3;
      const isDrizzle = rainType >= 0.7;
      const isModerateRain = !isHeavyRain && !isDrizzle;
      
      environmentalData = {
        timestamp: now,
        weather: isHeavyRain ? 'Heavy Rain' : (isDrizzle ? 'Drizzle' : 'Rain'),
        air_temp: getRandomInRange(5, 10),  // Rain days are cooler in Kerry
        humidity: isHeavyRain ? 
                  getRandomInRange(92, 98) : // Heavy rain brings maximum humidity
                  getKerryHumidity(isDrizzle ? 'Drizzle' : 'Rain'),
        windSpeed: getKerryWindSpeed(isHeavyRain || Math.random() > 0.6),  // Often stormy with rain
        ghi: getRandomInRange(30, 120),  // Low GHI during rainy conditions
        dni: getRandomInRange(10, 60)    // Very low DNI during rainy conditions
      };
      break;
      
    case 'stormy':
      // Atlantic storm - common in Kerry year-round but especially in winter/spring
      powerData = {
        timestamp: now,
        mainGridPower: getRandomInRange(14, 16),  // High grid import, no solar
        solarOutput: getRandomInRange(0.1, 0.5),  // Almost no solar generation
        refrigerationLoad: getRandomInRange(12, 15),
        bigColdRoom: getRandomInRange(5, 7),
        bigFreezer: getRandomInRange(6, 7),
        smoker: getRandomInRange(0.1, 0.12),
        totalLoad: getRandomInRange(16, 19),
        unaccountedLoad: getRandomInRange(1.8, 2.8)
      };
      
      environmentalData = {
        timestamp: now,
        weather: Math.random() > 0.5 ? 'Heavy Rain' : 'Rain',
        air_temp: getRandomInRange(4, 9),  // Storms bring cooler temperatures
        humidity: getRandomInRange(92, 98),  // Extremely high humidity
        windSpeed: getRandomInRange(30, 50),  // Very high winds typical of Kerry Atlantic storms
        ghi: getRandomInRange(0, 80),  // Almost no GHI during storms
        dni: getRandomInRange(0, 30)   // Almost no DNI during storms
      };
      break;
      
    default:
      // Default to a random realistic Kerry weather scenario
      // Weighted heavily toward cloudy/rainy to reflect reality
      const kerryWeatherScenarios = [
        'cloudy', 'cloudy', 'cloudy',  // 30% cloudy (most common)
        'rain', 'rain', 'rain',        // 30% rain (frequent)
        'drizzle', 'drizzle',          // 20% drizzle (common)
        'stormy',                      // 10% stormy (regular occurrence)
        'sunny'                        // 10% sunny (rarer)
      ]; 
      const randomScenario = kerryWeatherScenarios[Math.floor(Math.random() * kerryWeatherScenarios.length)];
      return generateSyntheticData(
        randomScenario === 'drizzle' ? 'rain' : 
        randomScenario === 'partly_cloudy' ? 'peak' : 
        randomScenario
      );
  }
  
  // Ensure totalLoad is at least the sum of the main components
  const minTotal = powerData.mainGridPower + powerData.solarOutput;
  if (powerData.totalLoad < minTotal) {
    powerData.totalLoad = minTotal + getRandomInRange(0.5, 1.5);
  }
  
  return { powerData, environmentalData };
}
