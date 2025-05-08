import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { usePowerData } from "@/hooks/use-power-data";

interface AIAnalyticsOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useAIAnalytics(options: AIAnalyticsOptions = {}) {
  const { powerData, environmentalData, isLoading: isDataLoading } = usePowerData();
  const [isGenerating, setIsGenerating] = useState(false);

  // Get the mutation function for analytics API
  const analyticsQuery = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/ai/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate analytics');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setIsGenerating(false);
      if (options.onSuccess) {
        options.onSuccess(data);
      }
    },
    onError: (error: Error) => {
      setIsGenerating(false);
      if (options.onError) {
        options.onError(error);
      }
    },
  });

  // Get the mutation function for report API
  const reportQuery = useMutation({
    mutationFn: async ({ data, reportType }: { data: any, reportType: string }) => {
      const response = await fetch('/api/ai/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, reportType }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate report');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setIsGenerating(false);
      if (options.onSuccess) {
        options.onSuccess(data);
      }
    },
    onError: (error: Error) => {
      setIsGenerating(false);
      if (options.onError) {
        options.onError(error);
      }
    },
  });

  // Get the mutation function for predictions API
  const predictionsQuery = useMutation({
    mutationFn: async ({ data, forecastHorizon }: { data: any, forecastHorizon: string }) => {
      const response = await fetch('/api/ai/predictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, forecastHorizon }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate predictions');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setIsGenerating(false);
      if (options.onSuccess) {
        options.onSuccess(data);
      }
    },
    onError: (error: Error) => {
      setIsGenerating(false);
      if (options.onError) {
        options.onError(error);
      }
    },
  });

  // Generate analytics with current data
  const generateAnalytics = async (historicalPowerData: any[] = [], historicalEnvData: any[] = []) => {
    setIsGenerating(true);
    
    try {
      const data = {
        currentPower: powerData.length > 0 ? powerData[0] : {},
        environmentalData: environmentalData.length > 0 ? environmentalData[0] : {},
        powerTrend: historicalPowerData.length > 0 ? historicalPowerData : powerData,
        environmentalTrend: historicalEnvData.length > 0 ? historicalEnvData : environmentalData,
      };
      
      return analyticsQuery.mutateAsync(data);
    } catch (error) {
      setIsGenerating(false);
      throw error;
    }
  };

  // Generate executive report with current data
  const generateReport = async (reportType: string, historicalPowerData: any[] = [], historicalEnvData: any[] = []) => {
    setIsGenerating(true);
    
    try {
      const data = {
        currentPower: powerData.length > 0 ? powerData[0] : {},
        environmentalData: environmentalData.length > 0 ? environmentalData[0] : {},
        powerTrend: historicalPowerData.length > 0 ? historicalPowerData : powerData,
        environmentalTrend: historicalEnvData.length > 0 ? historicalEnvData : environmentalData,
      };
      
      return reportQuery.mutateAsync({ data, reportType });
    } catch (error) {
      setIsGenerating(false);
      throw error;
    }
  };

  // Generate predictions with current data
  const generatePredictions = async (forecastHorizon: string, historicalPowerData: any[] = [], historicalEnvData: any[] = []) => {
    setIsGenerating(true);
    
    try {
      const data = {
        currentPower: powerData.length > 0 ? powerData[0] : {},
        environmentalData: environmentalData.length > 0 ? environmentalData[0] : {},
        powerTrend: historicalPowerData.length > 0 ? historicalPowerData : powerData,
        environmentalTrend: historicalEnvData.length > 0 ? historicalEnvData : environmentalData,
      };
      
      return predictionsQuery.mutateAsync({ data, forecastHorizon });
    } catch (error) {
      setIsGenerating(false);
      throw error;
    }
  };

  return {
    isLoading: isDataLoading || isGenerating,
    isGenerating,
    generateAnalytics,
    generateReport,
    generatePredictions,
    analyticsQuery,
    reportQuery,
    predictionsQuery,
  };
}