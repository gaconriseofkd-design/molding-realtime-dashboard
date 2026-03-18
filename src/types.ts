export interface Mold {
  id: string;
  name: string;
  size: string;
  qty: number;
  updatedAt?: string;
}

export interface Machine {
  id: string;
  name: string;
  moldsRunning: number;
  maxMolds: number;
  loadPercentage: number;
  status: 'optimal' | 'warning' | 'underutilized';
  operationalStatus: 'active' | 'stop' | 'pause';
  molds: Mold[];
}

export interface MoldMaster {
  id: string;
  size: string;
  totalOwned: number;
  currentlyRunning: number;
  status: string;
}

export interface DashboardStats {
  totalCapacityUtilization: number;
  totalMachines: number;
  totalMoldsRunning: number;
  totalMoldsCapacity: number;
}
