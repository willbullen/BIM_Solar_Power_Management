import { SolcastService } from './server/solcast-service.js';

async function testSolcastAPI() {
  try {
    // Initialize service with our token and Kerry, Ireland coordinates
    const service = new SolcastService(
      'XMKoLyczxaT3Qzt33MTkZS1gvg8ZJkO0',
      52.059937,  // Latitude for Kerry, Ireland
      -9.507269   // Longitude for Kerry, Ireland
    );
    
    // Fetch just 2 hours of forecast data for testing
    const forecastData = await service.getForecastData(2);
    console.log("Raw Solcast API response:");
    console.log(JSON.stringify(forecastData, null, 2));
    
    // Map the data to our format
    const mappedData = service.mapToEnvironmentalData(forecastData);
    console.log("\nMapped to our EnvironmentalData format:");
    console.log(JSON.stringify(mappedData, null, 2));
  } catch (error) {
    console.error("Error testing Solcast API:", error);
  }
}

// Run the test
testSolcastAPI();
