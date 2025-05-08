/**
 * Test script for the Solcast API integration
 * 
 * This script tests the Solcast API access and functionality
 * to ensure proper configuration and data retrieval.
 */

const fetch = require('node-fetch');

// To be replaced with actual API key from environment variable
const SOLCAST_API_KEY = process.env.SOLCAST_API_KEY || 'demo-key';

// These coordinates can be customized based on the location of interest
const LATITUDE = 52.059937;  // Kerry, Ireland default
const LONGITUDE = -9.507269; // Kerry, Ireland default

// Test PV system parameters
const CAPACITY = 25; // System capacity in kW
const TILT = 30;     // Panel tilt in degrees
const AZIMUTH = 180; // Panel azimuth (180° = south facing)

/**
 * Test function for forecast radiation and weather data
 */
async function testForecastRadiationData() {
  try {
    console.log('Testing Solcast Forecast Radiation API...');
    
    const url = `https://api.solcast.com.au/data/forecast/radiation_and_weather?latitude=${LATITUDE}&longitude=${LONGITUDE}&hours=48&output_parameters=ghi,dni,dhi,air_temp,cloud_opacity,wind_speed_10m,wind_direction_10m&period=PT30M&format=json`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SOLCAST_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Forecast radiation data received:');
    console.log(`Total entries: ${data.forecasts.length}`);
    console.log('First entry sample:');
    console.log(data.forecasts[0]);
    
    return true;
  } catch (error) {
    console.error('Error testing forecast radiation data:', error.message);
    return false;
  }
}

/**
 * Test function for PV power forecast data
 */
async function testPvForecastData() {
  try {
    console.log('\nTesting Solcast PV Power Forecast API...');
    
    const url = `https://api.solcast.com.au/data/forecast/rooftop_pv_power?latitude=${LATITUDE}&longitude=${LONGITUDE}&capacity=${CAPACITY}&tilt=${TILT}&azimuth=${AZIMUTH}&hours=48&output_parameters=pv_estimate,pv_estimate10,pv_estimate90&period=PT30M&format=json`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SOLCAST_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('PV power forecast data received:');
    console.log(`Total entries: ${data.forecasts.length}`);
    console.log('First entry sample:');
    console.log(data.forecasts[0]);
    
    return true;
  } catch (error) {
    console.error('Error testing PV forecast data:', error.message);
    return false;
  }
}

/**
 * Test function for live radiation and weather data
 */
async function testLiveRadiationData() {
  try {
    console.log('\nTesting Solcast Live Radiation API...');
    
    const url = `https://api.solcast.com.au/data/live/radiation_and_weather?latitude=${LATITUDE}&longitude=${LONGITUDE}&output_parameters=ghi,dni,dhi,air_temp,cloud_opacity,wind_speed_10m,wind_direction_10m&format=json`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SOLCAST_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Live radiation data received:');
    console.log(`Total entries: ${data.estimated_actuals.length}`);
    console.log('First entry sample:');
    console.log(data.estimated_actuals[0]);
    
    return true;
  } catch (error) {
    console.error('Error testing live radiation data:', error.message);
    return false;
  }
}

/**
 * Test function for live PV power data
 */
async function testLivePvData() {
  try {
    console.log('\nTesting Solcast Live PV Power API...');
    
    const url = `https://api.solcast.com.au/data/live/rooftop_pv_power?latitude=${LATITUDE}&longitude=${LONGITUDE}&capacity=${CAPACITY}&tilt=${TILT}&azimuth=${AZIMUTH}&format=json`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SOLCAST_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Live PV power data received:');
    console.log(`Total entries: ${data.estimated_actuals.length}`);
    console.log('First entry sample:');
    console.log(data.estimated_actuals[0]);
    
    return true;
  } catch (error) {
    console.error('Error testing live PV data:', error.message);
    return false;
  }
}

/**
 * Run all the tests
 */
async function runTests() {
  console.log('==============================');
  console.log('SOLCAST API INTEGRATION TESTS');
  console.log('==============================');
  console.log(`Using API key: ${SOLCAST_API_KEY}`);
  console.log(`Location: ${LATITUDE}, ${LONGITUDE}`);
  console.log(`PV system: ${CAPACITY}kW, tilt: ${TILT}°, azimuth: ${AZIMUTH}°`);
  console.log('------------------------------');
  
  let results = {
    forecastRadiation: false,
    pvForecast: false,
    liveRadiation: false,
    livePv: false
  };
  
  try {
    results.forecastRadiation = await testForecastRadiationData();
    results.pvForecast = await testPvForecastData();
    results.liveRadiation = await testLiveRadiationData();
    results.livePv = await testLivePvData();
  } catch (error) {
    console.error('Test execution error:', error);
  }
  
  console.log('\n==============================');
  console.log('TEST RESULTS');
  console.log('==============================');
  console.log(`Forecast Radiation API: ${results.forecastRadiation ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`PV Forecast API: ${results.pvForecast ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`Live Radiation API: ${results.liveRadiation ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`Live PV API: ${results.livePv ? 'PASS ✓' : 'FAIL ✗'}`);
  
  const allPassed = Object.values(results).every(result => result);
  console.log('\nOverall result:');
  console.log(allPassed 
    ? '✓ All tests passed! Solcast API integration is working correctly.'
    : '✗ Some tests failed. See above for details.'
  );
  
  if (!allPassed && SOLCAST_API_KEY === 'demo-key') {
    console.log('\nNOTE: You are using the demo key. To run these tests properly:');
    console.log('1. Set SOLCAST_API_KEY environment variable with your actual API key');
    console.log('2. Rerun this test script');
  }
}

// Run all the tests
runTests();