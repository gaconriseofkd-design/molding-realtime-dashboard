import type { Machine } from '../types';
import { MachineCard } from './MachineCard';

interface MachineListProps {
  machines: Machine[];
  onMachineClick?: (machine: Machine) => void;
}

export function MachineList({ machines, onMachineClick }: MachineListProps) {
  return (
    <>
      {machines.map((machine, idx) => (
        <MachineCard key={machine.id} index={idx} machine={machine} onClick={() => onMachineClick?.(machine)} />
      ))}
    </>
  );
}
