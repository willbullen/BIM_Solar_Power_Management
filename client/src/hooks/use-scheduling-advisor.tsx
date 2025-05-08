import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForecastData } from './use-forecast-data';
import { format, addHours, isBefore, isAfter, parseISO } from 'date-fns';

export interface SchedulingRecommendation {
  id: string;
  equipmentId: number;
  equipmentName: string;
  recommendationType: 'postpone' | 'advance' | 'optimal' | 'avoid';
  timeWindow: {
    start: Date;
    end: Date;
  };
  potentialSavings: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  solarForecast: number;
  loadProfile: number;
}

// Mock equipment data until we implement the backend
interface Equipment {
  id: number;
  name: string;
  type: string;
  model: string;
  manufacturer: string;
  installationDate: string;
  maintenanceInterval: number;
  lastMaintenanceDate: string;
  status: string;
  location: string;
  powerRequirement?: number;
  operationFlexibility?: 'none' | 'low' | 'medium' | 'high';
  operatingHoursPerDay?: number;
  optimalOperationTime?: string;
}

// Temporary mock data for demonstration purposes
const DEMO_EQUIPMENT: Equipment[] = [
  {
    id: 1,
    name: "Main Refrigeration",
    type: "refrigeration",
    model: "Cryotech TCX-4500",
    manufacturer: "CryoTech Industries",
    installationDate: "2023-03-15",
    maintenanceInterval: 90,
    lastMaintenanceDate: "2024-01-10",
    status: "operational",
    location: "Cold Storage A",
    powerRequirement: 25,
    operationFlexibility: "low",
    operatingHoursPerDay: 24
  },
  {
    id: 2,
    name: "Processing Line A",
    type: "processing",
    model: "FoodTech Pro-5000",
    manufacturer: "FoodTech Solutions",
    installationDate: "2023-05-20",
    maintenanceInterval: 60,
    lastMaintenanceDate: "2024-02-15",
    status: "operational",
    location: "Processing Area",
    powerRequirement: 18,
    operationFlexibility: "medium",
    operatingHoursPerDay: 12
  },
  {
    id: 3,
    name: "Processing Line B",
    type: "processing",
    model: "FoodTech Pro-5000X",
    manufacturer: "FoodTech Solutions",
    installationDate: "2023-07-10",
    maintenanceInterval: 60,
    lastMaintenanceDate: "2024-03-01",
    status: "operational",
    location: "Processing Area",
    powerRequirement: 18,
    operationFlexibility: "high",
    operatingHoursPerDay: 8
  },
  {
    id: 4,
    name: "Packaging System",
    type: "packaging",
    model: "PackMaster 3000",
    manufacturer: "PackTech Industries",
    installationDate: "2023-04-25",
    maintenanceInterval: 45,
    lastMaintenanceDate: "2024-02-28",
    status: "operational",
    location: "Packaging Area",
    powerRequirement: 12,
    operationFlexibility: "high",
    operatingHoursPerDay: 10
  }
];

export function useSchedulingAdvisor() {
  // Fetch forecast data
  const { 
    combinedData: forecastData, 
    isLoading: isLoadingForecast,
    selectedHorizon: horizon,
    setSelectedHorizon: setHorizon,
    isFallback 
  } = useForecastData();
  
  // Use demo equipment data for now
  const [equipmentData] = useState<Equipment[]>(DEMO_EQUIPMENT);
  const isLoadingEquipment = false;
  
  // Mocked efficiency data loading state
  const isLoadingEfficiency = false;
  
  // Generate recommendations based on forecast and equipment data
  const recommendations = useMemo(() => {
    if (!forecastData || !equipmentData || isLoadingForecast || isLoadingEquipment) {
      return [];
    }
    
    // This is where our recommendation algorithm will run
    const recommendations: SchedulingRecommendation[] = [];
    
    // Find peak solar production periods in the forecast
    const sortedByPvOutput = [...forecastData].sort((a, b) => (b.pv_estimate || 0) - (a.pv_estimate || 0));
    const highSolarPeriods = sortedByPvOutput.slice(0, Math.floor(sortedByPvOutput.length * 0.2)); // Top 20%
    
    // Find optimal operation times based on solar output and equipment efficiency
    equipmentData.forEach(equipment => {
      if (equipment.type === 'refrigeration' || equipment.type === 'processing') {
        // For energy-intensive equipment, suggest operation during high solar periods
        if (highSolarPeriods.length > 0) {
          // Find the best continuous block of solar production
          const bestPeriod = findBestContinuousPeriod(highSolarPeriods, equipment.powerRequirement || 10);
          
          if (bestPeriod) {
            recommendations.push({
              id: `optimal-${equipment.id}-${Date.now()}`,
              equipmentId: equipment.id,
              equipmentName: equipment.name,
              recommendationType: 'optimal',
              timeWindow: {
                start: parseISO(bestPeriod.start),
                end: parseISO(bestPeriod.end)
              },
              potentialSavings: calculatePotentialSavings(bestPeriod.avgPvOutput, equipment.powerRequirement || 10),
              confidence: bestPeriod.avgPvOutput > 15 ? 'high' : 'medium',
              reason: `High solar production period, optimal for ${equipment.name} operation`,
              solarForecast: bestPeriod.avgPvOutput,
              loadProfile: equipment.powerRequirement || 10
            });
          }
        }
        
        // Find periods to avoid (low solar, high grid prices)
        const lowSolarPeriods = forecastData
          .filter(d => (d.pv_estimate || 0) < 5) // Less than 5kW production
          .filter(d => {
            const hour = new Date(d.timestamp).getHours();
            return hour >= 16 && hour <= 20; // Typical peak grid price hours
          });
          
        if (lowSolarPeriods.length > 0 && equipment.operationFlexibility !== 'none') {
          const avoidPeriod = findContinuousPeriod(lowSolarPeriods);
          
          if (avoidPeriod) {
            recommendations.push({
              id: `avoid-${equipment.id}-${Date.now()}`,
              equipmentId: equipment.id,
              equipmentName: equipment.name,
              recommendationType: 'avoid',
              timeWindow: {
                start: parseISO(avoidPeriod.start),
                end: parseISO(avoidPeriod.end)
              },
              potentialSavings: calculatePotentialSavings(5, equipment.powerRequirement || 10) * 0.5, // Adjusted for avoided costs
              confidence: 'high',
              reason: `Low solar production and high grid price period, consider postponing operation`,
              solarForecast: 0, // Low solar
              loadProfile: equipment.powerRequirement || 10
            });
          }
        }
      }
      
      // For equipment with operation flexibility, suggest optimal scheduling
      if (equipment.operationFlexibility === 'high') {
        // Suggest advancing operation to take advantage of upcoming good solar conditions
        const nextHighSolarPeriod = findNextHighSolarPeriod(forecastData);
        
        if (nextHighSolarPeriod) {
          recommendations.push({
            id: `advance-${equipment.id}-${Date.now()}`,
            equipmentId: equipment.id,
            equipmentName: equipment.name,
            recommendationType: 'advance',
            timeWindow: {
              start: parseISO(nextHighSolarPeriod.start),
              end: parseISO(nextHighSolarPeriod.end)
            },
            potentialSavings: calculatePotentialSavings(nextHighSolarPeriod.avgPvOutput, equipment.powerRequirement || 10) * 0.7,
            confidence: 'medium',
            reason: `Upcoming high solar period, consider scheduling ${equipment.name} during this time`,
            solarForecast: nextHighSolarPeriod.avgPvOutput,
            loadProfile: equipment.powerRequirement || 10
          });
        }
      }
    });
    
    // Sort recommendations by potential savings (highest first)
    return recommendations.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }, [forecastData, equipmentData, isLoadingForecast, isLoadingEquipment]);
  
  return {
    recommendations,
    isLoading: isLoadingForecast || isLoadingEquipment || isLoadingEfficiency,
    isFallback,
    horizon,
    setHorizon
  };
}

// Helper functions for identifying optimal periods
function findBestContinuousPeriod(
  forecastPoints: any[], 
  powerRequirement: number
): { start: string, end: string, avgPvOutput: number } | null {
  if (forecastPoints.length === 0) return null;
  
  // Sort by timestamp
  const sortedPoints = [...forecastPoints].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  let bestPeriod = null;
  let maxAvgOutput = 0;
  
  // Look for continuous periods
  for (let i = 0; i < sortedPoints.length - 2; i++) {
    // We need at least 3 continuous hours for a good recommendation
    const current = sortedPoints[i];
    const next1 = sortedPoints[i + 1];
    const next2 = sortedPoints[i + 2];
    
    // Check if these points are consecutive
    const currentTime = new Date(current.timestamp);
    const next1Time = new Date(next1.timestamp);
    const next2Time = new Date(next2.timestamp);
    
    const isConsecutive = (
      Math.abs(next1Time.getTime() - currentTime.getTime()) <= 3600000 && // 1 hour diff
      Math.abs(next2Time.getTime() - next1Time.getTime()) <= 3600000      // 1 hour diff
    );
    
    if (isConsecutive) {
      const avgOutput = (current.pv_estimate + next1.pv_estimate + next2.pv_estimate) / 3;
      
      if (avgOutput > maxAvgOutput) {
        maxAvgOutput = avgOutput;
        bestPeriod = {
          start: current.timestamp,
          end: next2.timestamp,
          avgPvOutput: avgOutput
        };
      }
    }
  }
  
  return bestPeriod;
}

function findContinuousPeriod(
  forecastPoints: any[]
): { start: string, end: string } | null {
  if (forecastPoints.length === 0) return null;
  
  // Sort by timestamp
  const sortedPoints = [...forecastPoints].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // For simplicity, just return the first period that spans at least 2 hours
  if (sortedPoints.length >= 2) {
    return {
      start: sortedPoints[0].timestamp,
      end: sortedPoints[sortedPoints.length - 1].timestamp
    };
  }
  
  return null;
}

function findNextHighSolarPeriod(
  forecastData: any[]
): { start: string, end: string, avgPvOutput: number } | null {
  const now = new Date();
  const tomorrowData = forecastData.filter(d => {
    const forecastDate = new Date(d.timestamp);
    return isAfter(forecastDate, now) && (d.pv_estimate || 0) > 10;
  });
  
  return findBestContinuousPeriod(tomorrowData, 5);
}

function calculatePotentialSavings(solarOutput: number, powerRequirement: number): number {
  // Simple calculation based on solar output, power requirement and assumed electricity price
  const gridElectricityPrice = 0.25; // €/kWh
  const operationHours = 3; // Assuming 3 hour operation
  
  // How much of the power requirement can be covered by solar
  const solarCoverage = Math.min(1, solarOutput / powerRequirement);
  
  // Potential cost savings from using solar instead of grid electricity
  return powerRequirement * operationHours * solarCoverage * gridElectricityPrice;
}