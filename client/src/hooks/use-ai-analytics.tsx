import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { usePowerData } from "@/hooks/use-power-data";
import { apiRequest } from "@/lib/queryClient";

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
      return apiRequest('POST', '/api/ai/analytics', data);
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
      return apiRequest('POST', '/api/ai/report', { data, reportType });
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
      return apiRequest('POST', '/api/ai/predictions', { data, forecastHorizon });
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