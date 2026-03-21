import type { Machine } from '../types';
import { MachineCard } from './MachineCard';

interface MachineListProps {
  machines: Machine[];
  onMachineClick?: (machine: Machine) => void;
  onStatusChange?: (machine: Machine, newStatus: 'active' | 'stop' | 'pause') => void;
  onRefresh?: () => void;
}

export function MachineList({ machines, onMachineClick, onStatusChange, onRefresh }: MachineListProps) {
  return (
    <>
      {machines.map((machine, idx) => (
        <MachineCard
          key={machine.id}
          index={idx}
          machine={machine}
          onClick={() => onMachineClick?.(machine)}
          onStatusChange={onStatusChange}
          onRefresh={onRefresh}
        />
      ))}
    </>
  );
}
