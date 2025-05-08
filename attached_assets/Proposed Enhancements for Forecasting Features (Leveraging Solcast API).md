# Proposed Enhancements for Forecasting Features (Leveraging Solcast API)

This document outlines specific proposals to enhance the forecasting features of the Emporium Power Monitoring Dashboard by integrating data from the Solcast API. These suggestions aim to improve accuracy, provide more detailed insights, and expand the forecasting capabilities of the application.

## 1. Enhance Existing "Power Usage Forecast" with Solcast Data

*   **Proposal 1.1: Integrate Solcast PV Power Forecast into "Solar Output" Forecast.**
    *   **Current State:** The application currently forecasts "Solar Output" based on historical patterns and general environmental factors.
    *   **Enhancement:** Replace or augment the current "Solar Output" forecast with high-resolution PV power forecasts directly from the Solcast API (e.g., using endpoints like `GET /data/forecast/rooftop_pv_power` or `GET /data/forecast/advanced_pv_power` depending on the site setup). Solcast provides P10, P50, and P90 estimates, which can be used to show a range of likely generation (e.g., display P50 as the main forecast and P10-P90 as the confidence band, similar to the existing "Forecast Confidence" for total load).
    *   **Solcast API Endpoints:** `GET /data/forecast/rooftop_pv_power` or `GET /data/forecast/advanced_pv_power`.
    *   **Solcast Data Points:** `pv_estimate` (for P50), `pv_estimate10`, `pv_estimate90`.
    *   **Benefit:** Significantly improves the accuracy and reliability of the solar generation forecast, leading to better overall energy planning and optimization decisions.

*   **Proposal 1.2: Incorporate Solcast Weather Forecasts into Overall Load Forecast.**
    *   **Current State:** The load forecast considers "environmental factors," but the source and granularity are not specified.
    *   **Enhancement:** Integrate detailed weather forecast parameters from Solcast (e.g., `air_temp`, `cloud_cover`, `ghi`, `dni`) into the existing load forecasting model. This can help refine predictions for weather-sensitive loads (e.g., refrigeration, HVAC if applicable).
    *   **Solcast API Endpoints:** `GET /data/forecast/radiation_and_weather`.
    *   **Solcast Data Points:** `air_temp`, `cloud_opacity` (as a proxy for cloud cover), `ghi`, `dni`, `wind_speed_10m`, `wind_direction_10m`.
    *   **Benefit:** Increases the accuracy of the total load forecast by incorporating more precise and relevant weather data.

*   **Proposal 1.3: Extend Forecast Horizon.**
    *   **Current State:** The forecast horizon is 24 hours.
    *   **Enhancement:** Leverage Solcast's capability to provide forecasts for up to 7 days (or longer, depending on the specific Solcast product/plan). Offer users options to view forecasts for 24 hours, 48 hours, 72 hours, and 7 days on the "Forecasting" page.
    *   **Solcast API Endpoints:** All forecast endpoints support variable forecast durations (typically up to 168 hours/7 days, check specific endpoint documentation for exact limits).
    *   **Benefit:** Enables better medium-term planning for operations, energy procurement, and maintenance scheduling.

## 2. Enhance the "Environment" Tab within Forecasting

*   **Proposal 2.1: Display Detailed Solcast Weather Forecasts.**
    *   **Current State:** The "Environment" tab under Forecasting is not detailed in the existing workflow documentation but is a logical place for weather data.
    *   **Enhancement:** Create a dedicated view within the "Environment" tab (or a new sub-tab) to display detailed weather forecasts obtained from Solcast for the selected forecast horizon. This should include:
        *   Air Temperature (graph over time, min/max values).
        *   Cloud Cover/Opacity (graph or visual representation over time).
        *   Global Horizontal Irradiance (GHI) (graph over time).
        *   Direct Normal Irradiance (DNI) (graph over time).
        *   Wind Speed and Direction.
    *   **Solcast API Endpoints:** `GET /data/forecast/radiation_and_weather`.
    *   **Solcast Data Points:** `air_temp`, `cloud_opacity`, `ghi`, `dni`, `wind_speed_10m`, `wind_direction_10m`, `period_end`.
    *   **Benefit:** Provides the factory owner with a comprehensive weather outlook, which is crucial for understanding potential impacts on solar generation and energy demand.

## 3. Improve Forecast Visualization and Details

*   **Proposal 3.1: Add Specific Solar Irradiance Forecast Graph.**
    *   **Enhancement:** Alongside the "Power Usage Forecast," add a new graph specifically for solar irradiance forecasts (GHI, DNI, and potentially DHI if calculated or provided). This would visually complement the PV power output forecast.
    *   **Solcast API Endpoints:** `GET /data/forecast/radiation_and_weather`.
    *   **Solcast Data Points:** `ghi`, `dni`, `dhi` (if available/calculated), `period_end`.
    *   **Benefit:** Offers deeper insight into the primary driver of solar PV generation, helping to understand variations in PV output.

*   **Proposal 3.2: Enhance "Forecast Details" Section.**
    *   **Current State:** Shows "Peak Forecast" (kW and time) and "Forecast Confidence" (kW).
    *   **Enhancement:** Expand this section to include:
        *   **Total Expected Solar Generation (kWh):** For the selected forecast period (e.g., next 24 hours, next 7 days).
        *   **Peak Solar Generation (kW) and Expected Time:** Derived from Solcast PV forecast.
        *   **Key Weather Summary:** e.g., Expected average temperature, predominant cloud conditions for the forecast period.
    *   **Benefit:** Provides a quick, digestible summary of key forecast metrics relevant to energy management.

## 4. Introduce Probabilistic Forecasting for PV Output

*   **Proposal 4.1: Visualize P10, P50, P90 PV Forecasts.**
    *   **Enhancement:** If not already done in Proposal 1.1, explicitly use Solcast’s P10, P50, and P90 PV power forecasts to create a probabilistic forecast display. The main graph line could be P50, with a shaded area representing the P10-P90 range.
    *   **Solcast API Endpoints:** `GET /data/forecast/rooftop_pv_power` or `GET /data/forecast/advanced_pv_power`.
    *   **Solcast Data Points:** `pv_estimate` (P50), `pv_estimate10`, `pv_estimate90`.
    *   **Benefit:** Gives the user a better understanding of the uncertainty and potential range of solar PV output, aiding in risk assessment for operational decisions.

## 5. Configuration and User Control

*   **Proposal 5.1: Allow Selection of Forecast Models/Parameters (Advanced).**
    *   **Enhancement (Optional, for advanced users):** If Solcast offers different forecast models or tunable parameters via the API (e.g., specific PV system degradation factors if not already part of the site setup in Solcast), consider exposing these in an advanced settings section for forecasting.
    *   **Benefit:** Provides greater flexibility for users with deep technical knowledge to fine-tune forecasts, though simplicity should be prioritized for the average user.

These proposals aim to leverage the rich data from the Solcast API to make the forecasting features of the Emporium Power Monitoring Dashboard more accurate, detailed, and actionable for the factory owner.
