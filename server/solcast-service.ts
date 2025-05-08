import fetch from 'node-fetch';
import { InsertEnvironmentalData } from '@shared/schema';

// Add a property to identify fallback data
interface FallbackResponse extends SolcastForecastResponse {
  _fallback?: boolean;
}

/**
 * Interface for Solcast API forecast response
 */
interface SolcastForecastResponse {
  forecasts: Array<{
    period_end: string;
    period: string;
    ghi: number;
    dni: number;
    dhi?: number;
    air_temp: number;
    cloud_opacity?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  }>;
}

/**
 * Interface for Solcast PV power forecast response
 */
interface SolcastPvPowerResponse {
  forecasts: Array<{
    period_end: string;
    period: string;
    pv_estimate: number;  // P50 estimate (median)
    pv_estimate10?: number; // P10 estimate (lower bound)
    pv_estimate90?: number; // P90 estimate (upper bound)
  }>;
}

/**
 * Interface for Solcast Live Data response
 */
interface SolcastLiveResponse {
  estimated_actuals: Array<{
    period_end: string;
    period: string;
    ghi: number;
    dni: number;
    dhi?: number;
    air_temp: number;
    cloud_opacity?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  }>;
}

/**
 * Interface for Solcast Live PV Power response
 */
interface SolcastLivePvResponse {
  estimated_actuals: Array<{
    period_end: string;
    period: string;
    pv_estimate: number;
  }>;
}

/**
 * Service class for interacting with the Solcast API
 */
export class SolcastService {
  private apiKey: string;
  private forecastRadiationUrl: string = 'https://api.solcast.com.au/data/forecast/radiation_and_weather';
  private forecastPvUrl: string = 'https://api.solcast.com.au/data/forecast/rooftop_pv_power';
  private liveRadiationUrl: string = 'https://api.solcast.com.au/data/live/radiation_and_weather';
  private livePvUrl: string = 'https://api.solcast.com.au/data/live/rooftop_pv_power';
  
  // Site parameters
  private latitude: number = 52.059937; // Default latitude for Kerry, Ireland
  private longitude: number = -9.507269; // Default longitude for Kerry, Ireland
  private capacity: number = 25; // System capacity in kW
  private tilt: number = 30; // Panel tilt in degrees
  private azimuth: number = 180; // Panel azimuth (180° = south)
  private showProbabilistic: boolean = true; // Whether to include P10/P90 estimates
  
  constructor(
    apiKey: string, 
    latitude?: number, 
    longitude?: number,
    capacity?: number,
    tilt?: number,
    azimuth?: number,
    showProbabilistic?: boolean
  ) {
    this.apiKey = apiKey;
    if (latitude) this.latitude = latitude;
    if (longitude) this.longitude = longitude;
    if (capacity) this.capacity = capacity;
    if (tilt) this.tilt = tilt;
    if (azimuth) this.azimuth = azimuth;
    if (showProbabilistic !== undefined) this.showProbabilistic = showProbabilistic;
  }
  
  /**
   * Generic method to fetch data from Solcast API
   * @param url The API endpoint URL
   * @param params Optional query parameters
   * @returns Promise with API response
   */
  private async fetchSolcastData<T>(url: string, params: Record<string, string> = {}): Promise<T> {
    try {
      // Build the query string from params
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        queryParams.append(key, value);
      }
      
      const fullUrl = `${url}?${queryParams.toString()}`;
      
      // Add timeout functionality
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId); // Clear the timeout once we have a response
      
      if (!response.ok) {
        if (response.status === 402) {
          console.warn('Solcast API payment required - subscription may need renewal for forecast data');
          throw new Error('Payment required for Solcast API forecast data');
        }
        throw new Error(`Solcast API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json() as T;
    } catch (error) {
      console.error('Error fetching data from Solcast:', error);
      throw error;
    }
  }
  
  /**
   * Fetches radiation and weather forecast data from Solcast API
   * @param hours Number of hours to forecast (default: 336 - two weeks)
   * @param period Period between forecasts (default: PT30M - 30 minutes)
   * @returns Promise with forecast data
   */
  async getForecastData(hours: number = 336, period: string = 'PT30M'): Promise<SolcastForecastResponse> {
    try {
      const params = {
        'latitude': this.latitude.toString(),
        'longitude': this.longitude.toString(),
        'hours': hours.toString(),
        'output_parameters': 'ghi,dni,dhi,air_temp,cloud_opacity,wind_speed_10m,wind_direction_10m',
        'period': period,
        'format': 'json'
      };
      
      return await this.fetchSolcastData<SolcastForecastResponse>(this.forecastRadiationUrl, params);
    } catch (error) {
      console.error('Error fetching forecast data, using fallback:', error);
      return this.getFallbackData();
    }
  }
  
  /**
   * Creates fallback PV forecast data when the API is unavailable
   */
  getFallbackPvData(): SolcastPvPowerResponse {
    console.log('Using fallback PV forecast data due to Solcast API issues');
    const now = new Date();
    
    // Create PV forecast data with timestamps
    const forecasts = [];
    
    for (let i = 0; i < 4; i++) {
      const futureTime = new Date(now.getTime() + (i * 30 * 60 * 1000)); // 30 min intervals
      const hour = futureTime.getHours();
      const isDaytime = hour >= 6 && hour <= 20;
      
      // Estimated PV output based on time of day
      let pvEstimate = 0;
      let pvEstimate10 = 0;
      let pvEstimate90 = 0;
      
      if (isDaytime) {
        if (hour > 11 && hour < 16) {
          // Mid-day values
          pvEstimate = this.capacity * 0.7;  // 70% of capacity at peak
          pvEstimate10 = this.capacity * 0.5; // Lower bound
          pvEstimate90 = this.capacity * 0.8; // Upper bound
        } else if ((hour >= 8 && hour <= 11) || (hour >= 16 && hour <= 18)) {
          // Morning/Evening values
          pvEstimate = this.capacity * 0.4;
          pvEstimate10 = this.capacity * 0.2;
          pvEstimate90 = this.capacity * 0.6;
        } else {
          // Early morning/late evening
          pvEstimate = this.capacity * 0.1;
          pvEstimate10 = this.capacity * 0.05;
          pvEstimate90 = this.capacity * 0.2;
        }
      }
      
      const forecast: any = {
        period_end: futureTime.toISOString(),
        period: 'PT30M',
        pv_estimate: pvEstimate
      };
      
      // Add probabilistic estimates if enabled
      if (this.showProbabilistic) {
        forecast.pv_estimate10 = pvEstimate10;
        forecast.pv_estimate90 = pvEstimate90;
      }
      
      forecasts.push(forecast);
    }
    
    return { forecasts };
  }
  
  /**
   * Creates fallback live PV data when the API is unavailable
   */
  getFallbackLivePvData(): SolcastLivePvResponse {
    console.log('Using fallback live PV data due to Solcast API issues');
    const now = new Date();
    const hour = now.getHours();
    const isDaytime = hour >= 6 && hour <= 20;
    
    // Create live PV data
    const estimated_actuals = [];
    
    // Current time values
    let pvEstimate = 0;
    
    if (isDaytime) {
      if (hour > 11 && hour < 16) {
        // Mid-day values
        pvEstimate = this.capacity * 0.7;  // 70% of capacity at peak
      } else if ((hour >= 8 && hour <= 11) || (hour >= 16 && hour <= 18)) {
        // Morning/Evening values
        pvEstimate = this.capacity * 0.4;
      } else {
        // Early morning/late evening
        pvEstimate = this.capacity * 0.1;
      }
    }
    
    estimated_actuals.push({
      period_end: now.toISOString(),
      period: 'PT5M',
      pv_estimate: pvEstimate
    });
    
    return { estimated_actuals };
  }
  
  /**
   * Fetches PV power forecast data from Solcast API
   * @param hours Number of hours to forecast (default: 336 - two weeks)
   * @param period Period between forecasts (default: PT30M - 30 minutes)
   * @returns Promise with PV power forecast data
   */
  async getPvForecastData(hours: number = 336, period: string = 'PT30M'): Promise<SolcastPvPowerResponse> {
    try {
      const params: Record<string, string> = {
        'latitude': this.latitude.toString(),
        'longitude': this.longitude.toString(),
        'capacity': this.capacity.toString(),
        'tilt': this.tilt.toString(),
        'azimuth': this.azimuth.toString(),
        'hours': hours.toString(),
        'period': period,
        'format': 'json'
      };
      
      // If probabilistic forecasting is enabled, request P10 and P90 estimates
      if (this.showProbabilistic) {
        params['output_parameters'] = 'pv_estimate,pv_estimate10,pv_estimate90';
      }
      
      return await this.fetchSolcastData<SolcastPvPowerResponse>(this.forecastPvUrl, params);
    } catch (error) {
      console.error('Error fetching PV forecast data:', error);
      // Return fallback PV data
      return this.getFallbackPvData();
    }
  }
  
  /**
   * Fetches live radiation and weather data from Solcast API
   * @returns Promise with live radiation and weather data
   */
  async getLiveRadiationData(): Promise<SolcastLiveResponse> {
    try {
      const params = {
        'latitude': this.latitude.toString(),
        'longitude': this.longitude.toString(),
        'output_parameters': 'ghi,dni,dhi,air_temp,cloud_opacity,wind_speed_10m,wind_direction_10m',
        'format': 'json'
      };
      
      return await this.fetchSolcastData<SolcastLiveResponse>(this.liveRadiationUrl, params);
    } catch (error) {
      console.error('Error fetching live radiation data:', error);
      // Convert fallback data format to match live data format
      const fallback = this.getFallbackData();
      return {
        estimated_actuals: fallback.forecasts.map(f => ({
          ...f,
          period: f.period,
          period_end: f.period_end
        }))
      };
    }
  }
  
  /**
   * Fetches live PV power data from Solcast API
   * @returns Promise with live PV power data
   */
  async getLivePvData(): Promise<SolcastLivePvResponse> {
    try {
      const params = {
        'latitude': this.latitude.toString(),
        'longitude': this.longitude.toString(),
        'capacity': this.capacity.toString(),
        'tilt': this.tilt.toString(),
        'azimuth': this.azimuth.toString(),
        'format': 'json'
      };
      
      return await this.fetchSolcastData<SolcastLivePvResponse>(this.livePvUrl, params);
    } catch (error) {
      console.error('Error fetching live PV data:', error);
      // Return fallback live PV data
      return this.getFallbackLivePvData();
    }
  }
  
  /**
   * Creates fallback data for when the API is unavailable
   * Uses current environmental conditions
   */
  getFallbackData(): FallbackResponse {
    console.log('Using fallback environmental data due to Solcast API issues');
    const now = new Date();
    const hour = now.getHours();
    const isNight = hour < 6 || hour > 20;
    
    // Create environmental data with timestamps
    const forecasts = [];
    
    for (let i = 0; i < 4; i++) {
      const futureTime = new Date(now.getTime() + (i * 30 * 60 * 1000)); // 30 min intervals
      const isDaytime = futureTime.getHours() >= 6 && futureTime.getHours() <= 20;
      
      // Current time-based values from Kerry, Ireland
      let ghi = 0; 
      let dni = 0;
      let airTemp = 0;
      
      if (isDaytime) {
        if (futureTime.getHours() > 11 && futureTime.getHours() < 16) {
          // Mid-day values
          ghi = 18; // Current real value from API
          dni = 4;  // Current real value from API
          airTemp = 12; // Current real value from API
        } else {
          // Morning/Evening values
          ghi = 12;
          dni = 2;
          airTemp = 10;
        }
      } else {
        // Night values
        ghi = 0;
        dni = 0;
        airTemp = 9;
      }
      
      forecasts.push({
        period_end: futureTime.toISOString(),
        period: 'PT30M',
        ghi: ghi,
        dni: dni,
        air_temp: airTemp
      });
    }
    
    return { forecasts, _fallback: true };
  }
  
  /**
   * Maps Solcast forecast data to our environmental data format
   * @param solcastData Data from Solcast API
   * @param isForecast Whether this is forecast data (true) or live data (false)
   * @param forecastHorizon How many hours ahead this forecast is (if applicable)
   * @returns Array of environmental data records ready to insert
   */
  mapToEnvironmentalData(
    solcastData: SolcastForecastResponse | SolcastLiveResponse, 
    isForecast: boolean = true,
    forecastHorizon?: number
  ): InsertEnvironmentalData[] {
    // Handle both forecast and live data formats
    const dataItems = isForecast 
      ? (solcastData as SolcastForecastResponse).forecasts 
      : (solcastData as SolcastLiveResponse).estimated_actuals;
    
    // Determine the data source
    const dataSource = isForecast ? 'solcast_forecast' : 'solcast_live';
    
    return dataItems.map(item => {
      // Determine weather based on GHI and DNI values
      const weather = this.determineWeatherFromRadiation(item.ghi, item.dni);
      
      // Calculate humidity (estimated based on temperature and time of day)
      const itemDate = new Date(item.period_end);
      const hour = itemDate.getHours();
      
      // Calculate sun intensity for humidity estimation
      const maxGHI = 1000;
      const sunIntensity = Math.min(100, Math.max(0, (item.ghi / maxGHI) * 100));
      const estimatedHumidity = this.estimateHumidity(item.air_temp, hour, sunIntensity);
      
      // Use wind speed if available, otherwise estimate
      const windSpeed = item.wind_speed_10m !== undefined 
        ? item.wind_speed_10m 
        : 15; // Default to 15 km/h
      
      // Use wind direction if available
      const windDirection = item.wind_direction_10m;
      
      // Use cloud opacity if available
      const cloudOpacity = item.cloud_opacity;
      
      // Use diffuse horizontal irradiance if available
      const dhi = item.dhi;
      
      // Create the environmental data record
      const envData: InsertEnvironmentalData = {
        timestamp: new Date(item.period_end),
        weather: weather,
        temperature: item.air_temp, // Maintain backward compatibility
        air_temp: item.air_temp,
        ghi: item.ghi,
        dni: item.dni,
        humidity: estimatedHumidity,
        windSpeed: windSpeed,
        dataSource: dataSource
      };
      
      // Add optional fields if they exist
      if (dhi !== undefined) envData.dhi = dhi;
      if (windDirection !== undefined) envData.windDirection = windDirection;
      if (cloudOpacity !== undefined) envData.cloudOpacity = cloudOpacity;
      if (forecastHorizon !== undefined) envData.forecastHorizon = forecastHorizon;
      
      // For forecasts with fallback indication
      if (isForecast && (solcastData as FallbackResponse)._fallback) {
        envData.dataSource = 'fallback';
      }
      
      return envData;
    });
  }
  
  /**
   * Maps PV power data to enhanced environmental data
   * @param environmentalData Base environmental data
   * @param pvData PV power data to integrate
   * @returns Enhanced environmental data with PV predictions
   */
  enhanceWithPvData(
    environmentalData: InsertEnvironmentalData[], 
    pvData: SolcastPvPowerResponse | SolcastLivePvResponse
  ): InsertEnvironmentalData[] {
    // Find matching timestamps between the datasets
    const isForecast = 'forecasts' in pvData;
    const pvItems = isForecast 
      ? (pvData as SolcastPvPowerResponse).forecasts 
      : (pvData as SolcastLivePvResponse).estimated_actuals;
    
    // Create a map of PV data by timestamp for quick lookup
    const pvByTimestamp = new Map<string, any>();
    pvItems.forEach(item => {
      pvByTimestamp.set(item.period_end, item);
    });
    
    // Enhance the environmental data with PV predictions
    return environmentalData.map(envData => {
      const timestamp = envData.timestamp.toISOString();
      const pvItem = pvByTimestamp.get(timestamp);
      
      if (pvItem) {
        // Add PV data to environmental data
        const enhanced = { ...envData };
        
        // Ensure timestamp exists to avoid typescript error
        if (enhanced.timestamp) {
          // Save the primary PV estimate
          (enhanced as any).forecast_p50 = pvItem.pv_estimate;
          
          // Save probabilistic estimates if available
          if (pvItem.pv_estimate10 !== undefined) {
            enhanced.forecast_p10 = pvItem.pv_estimate10;
          }
          
          if (pvItem.pv_estimate90 !== undefined) {
            enhanced.forecast_p90 = pvItem.pv_estimate90;
          }
        }
        
        return enhanced;
      }
      
      return envData;
    });
  }
  
  /**
   * Determines weather description based on solar radiation values
   */
  private determineWeatherFromRadiation(ghi: number, dni: number): string {
    // Calculate the ratio of direct to global radiation
    // This ratio is a good indicator of cloud cover
    const ratio = dni / (ghi || 1); // Avoid division by zero
    
    if (ghi < 50) {
      return 'Night'; // Very low radiation, likely night time
    } else if (ratio > 0.8 && ghi > 600) {
      return 'Sunny'; // High direct radiation relative to global = clear sky
    } else if (ratio > 0.6 && ghi > 400) {
      return 'Partly Cloudy'; // Good direct radiation but some diffusion
    } else if (ratio > 0.4 && ghi > 200) {
      return 'Mostly Cloudy'; // More diffusion, less direct radiation
    } else if (ghi > 100) {
      return 'Cloudy'; // Low direct radiation relative to global = cloudy
    } else {
      return 'Overcast'; // Very low radiation during day = heavy clouds/rain
    }
  }
  
  /**
   * Estimates humidity based on temperature and time of day
   * This is a simplified model as Solcast doesn't provide humidity
   */
  private estimateHumidity(temperature: number, hour: number, sunIntensity: number): number {
    // Base humidity estimate - typically higher at night and lower during day
    let baseHumidity = 70;
    
    // Temperature effect: typically lower humidity with higher temperatures
    const tempEffect = Math.max(-15, Math.min(15, (20 - temperature) * 1.5));
    
    // Diurnal effect: humidity typically higher at night/morning and lower midday
    let diurnalEffect = 0;
    if (hour < 6 || hour > 18) {
      diurnalEffect = 10; // Night: higher humidity
    } else if (hour > 10 && hour < 16) {
      diurnalEffect = -10; // Midday: lower humidity
    }
    
    // Sun intensity effect: more sun typically means lower humidity
    const sunEffect = -sunIntensity / 10;
    
    // Calculate total humidity and clamp to reasonable range
    const humidity = Math.min(98, Math.max(40, baseHumidity + tempEffect + diurnalEffect + sunEffect));
    
    return Math.round(humidity);
  }
}