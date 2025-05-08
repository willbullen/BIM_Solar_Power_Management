# Proposed Enhancements for Live Features (Leveraging Solcast API)

This document outlines specific proposals to enhance the live data features of the Emporium Power Monitoring Dashboard by integrating real-time and estimated actuals data from the Solcast API. These suggestions aim to improve the accuracy, granularity, and timeliness of the live information presented to the user.

## 1. Enhance "Current Metrics" with Solcast Live Data

*   **Proposal 1.1: Integrate Solcast Live PV Power Estimates for "Solar Output".**
    *   **Current State:** The "Solar Output" in "Current Metrics" likely comes from the on-site Emporium system. While valuable, Solcast can provide an independent, weather-model-calibrated estimate.
    *   **Enhancement:** Augment or provide an alternative view for "Solar Output" using Solcast's live PV power estimates (e.g., from `GET /data/live/rooftop_pv_power` or `GET /data/live/advanced_pv_power`). This can serve as a validation source or a more rapidly updating estimate if the on-site system has latency.
    *   **Solcast API Endpoints:** `GET /data/live/rooftop_pv_power` or `GET /data/live/advanced_pv_power` (these provide estimated actuals, which are near real-time).
    *   **Solcast Data Points:** `pv_estimate` (latest value from the `estimated_actuals` array).
    *   **Benefit:** Provides a potentially more accurate or rapidly updated solar output figure, and can help identify discrepancies if the on-site sensor data differs significantly from Solcast's model-based estimate.

## 2. Enrich the "Environment" Section with Solcast Live Weather Data

*   **Proposal 2.1: Display Solcast Live/Recent Weather Conditions.**
    *   **Current State:** The "Environment" section shows Weather (e.g., Night), Temperature, and Sun Intensity. The source of "Sun Intensity" is unclear and might be a local sensor or a basic calculation.
    *   **Enhancement:** Replace or augment the existing "Environment" data with more detailed and accurate live/recent weather parameters from Solcast. This should include:
        *   **Air Temperature:** Use Solcast's `air_temp`.
        *   **Sun Intensity/Irradiance:** Display live/recent Global Horizontal Irradiance (GHI) and Direct Normal Irradiance (DNI) from Solcast. This is a much more precise measure than a generic "Sun Intensity %."
        *   **Cloud Cover/Opacity:** Display Solcast's `cloud_opacity` as a measure of current cloud conditions.
        *   **Wind Speed & Direction:** Add live wind speed and direction from Solcast.
    *   **Solcast API Endpoints:** `GET /data/live/radiation_and_weather` (provides estimated actuals).
    *   **Solcast Data Points:** `air_temp`, `ghi`, `dni`, `cloud_opacity`, `wind_speed_10m`, `wind_direction_10m` (latest values from the `estimated_actuals` array).
    *   **Benefit:** Offers a more scientifically accurate and comprehensive view of the current environmental conditions impacting solar PV generation and potentially building energy load.

## 3. Enhance Live Dashboard Visualizations

*   **Proposal 3.1: More Frequent Updates for Solar-Related Metrics on Timeline Graph.**
    *   **Current State:** The "Power Usage Timeline" updates based on the general data refresh rate (configurable in Settings, e.g., 10 seconds).
    *   **Enhancement:** If Solcast live data can be polled more frequently (respecting API rate limits), consider updating the "Solar Output" line on the timeline graph with greater frequency using Solcast live estimates. This could provide a more dynamic view of solar generation fluctuations.
    *   **Benefit:** Improves the real-time responsiveness of the solar generation display.

*   **Proposal 3.2: Visual Indicators for Live Solar Conditions.**
    *   **Enhancement:** Add small, intuitive icons or color-coded indicators to the dashboard that reflect live solar conditions based on Solcast data. For example:
        *   A sun icon that changes appearance based on GHI levels (e.g., bright sun for high GHI, cloudy sun for moderate, clouds for low GHI).
        *   An indicator for cloud opacity.
    *   **Benefit:** Provides an at-a-glance understanding of current solar resource availability.

## 4. Data Validation and System Health (Live)

*   **Proposal 4.1: Compare On-Site PV Output with Solcast Live Estimate.**
    *   **Enhancement:** Display both the on-site measured PV output (from Emporium) and Solcast's live `pv_estimate` side-by-side or as an overlay. Calculate and display the delta.
    *   **Benefit:** Helps in quickly identifying potential issues with the on-site PV system or sensors if there's a significant and persistent discrepancy between the two readings (after accounting for normal modeling tolerances).
    *   **Actionable Insight:** If the delta exceeds a configurable threshold for a certain duration, trigger an alert for the user to investigate potential PV system underperformance or sensor malfunction.

## 5. API Integration Considerations for Live Data

*   **Update Frequency:** Determine an optimal polling frequency for Solcast live data endpoints that balances the need for fresh data with API rate limits and subscription costs. Solcast's "live" data is typically updated every 5-15 minutes for irradiance and weather, and PV estimates are also near real-time.
*   **Data Caching:** Implement appropriate caching mechanisms to avoid redundant API calls if multiple dashboard components need the same live data.
*   **Error Handling:** Robustly handle API errors (e.g., rate limits, temporary unavailability) and provide graceful fallbacks or indicators to the user (e.g., "Live solar data temporarily unavailable").

These proposals for live feature enhancements aim to make the Emporium Power Monitoring Dashboard more dynamic, accurate, and insightful by leveraging the real-time and estimated actuals data provided by the Solcast API.
