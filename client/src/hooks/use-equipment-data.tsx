import { useQuery } from '@tanstack/react-query';

// Define equipment types
export interface Equipment {
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

export function useEquipmentData() {
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery<Equipment[]>({
    queryKey: ['/api/equipment'],
  });

  return {
    data,
    isLoading,
    error,
    refetch
  };
}