# Solcast API Integration Enhancement Plan

This document outlines the implementation strategy for enhancing the Emporium Power Monitoring Dashboard by leveraging the Solcast API according to the provided requirements.

## Current System Analysis

- The application already has Solcast API integration, but with limited features
- Current implementation includes fallback mechanisms for when API is unavailable
- Settings page already has fields for Solcast API key and location coordinates
- We need to enhance both live data and forecasting features

## Implementation Stages

### Stage 1: Schema Enhancements
- [x] Update environmental_data schema to include additional fields:
  - Add wind_speed and wind_direction fields
  - Add cloud_opacity field
  - Ensure proper support for probabilistic forecasting (P10, P50, P90 values)

### Stage 2: SolcastService Enhancement
- [ ] Update SolcastService to fetch and process more data points:
  - Implement live data endpoints 
  - Expand forecast data to include P10/P90 values
  - Add support for longer forecast horizons (up to 7 days)
  - Enhance weather determination logic using more parameters
  - Improve fallback data generation to match expanded schema

### Stage 3: Backend API Enhancements
- [ ] Update routes.ts to support new data endpoints:
  - Add endpoint for fetching extended forecast data
  - Add endpoint for validating system performance (actual vs expected)
  - Add endpoint for historical comparison data
  - Add support for different forecast horizons
  - Implement data caching for Solcast API calls

### Stage 4: Frontend Enhancements - Core Features
- [ ] Enhance "Current Metrics" with Solcast live data
  - Display live PV power estimates alongside actual readings
  - Show delta/difference analysis
- [ ] Enrich Environment section with detailed weather data
  - Add visual indicators for solar conditions
  - Display GHI/DNI values instead of simple sun intensity
  - Add cloud opacity visualization
  - Add wind data visualization

### Stage 5: Frontend Enhancements - Forecasting
- [ ] Enhance Power Usage Forecast with Solcast data
  - Show probabilistic forecasts (P10/P50/P90)
  - Implement confidence bands visualization
  - Add forecast horizon selection (24h, 48h, 72h, 7 days)
- [ ] Improve Environment tab with detailed weather forecasts
  - Add comprehensive weather parameter visualization
  - Add min/max value indicators
  - Create visual timeline of expected conditions

### Stage 6: Advanced Features (If Time Permits)
- [ ] Implement Dynamic Operational Scheduling Advisor
  - Create load shifting recommendations based on forecast
  - Integrate with equipment efficiency data
- [ ] Implement Advanced PV System Health Monitoring
  - Track performance ratio over time
  - Detect and alert on degradation trends
- [ ] Add Soiling & Microclimate Impact Assessment
  - Compare performance across different array sections

## Current Progress

Starting implementation with Stage 1: Schema Enhancements.