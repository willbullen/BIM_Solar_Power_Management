import { SolcastService } from './server/solcast-service.js';

// Sample response from API (simplified)
const sampleData = {
  forecasts: [
    {
      air_temp: 15,
      dni: 837,
      ghi: 792,
      period_end: '2025-05-08T11:30:00.0000000Z',
      period: 'PT30M'
    },
    {
      air_temp: 16,
      dni: 832,
      ghi: 814,
      period_end: '2025-05-08T12:00:00.0000000Z',
      period: 'PT30M'
    }
  ]
};

// Initialize service with our token
const service = new SolcastService('XMKoLyczxaT3Qzt33MTkZS1gvg8ZJkO0');

// Map the data 
const mappedData = service.mapToEnvironmentalData(sampleData);

// Print the result
console.log(JSON.stringify(mappedData, null, 2));
