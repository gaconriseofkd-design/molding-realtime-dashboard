import type { Machine } from '../types';
import { MachineCard } from './MachineCard';

interface MachineListProps {
  machines: Machine[];
  onMachineClick?: (machine: Machine) => void;
}

export function MachineList({ machines, onMachineClick }: MachineListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {machines.map((machine, idx) => (
        <MachineCard key={machine.id} index={idx} machine={machine} onClick={() => onMachineClick?.(machine)} />
      ))}
    </div>
  );
}
