import { Bike, Car, Map, Mountain, Scooter, Waves, Wind, type LucideProps } from "lucide-react";

const MAP: Record<string, React.ComponentType<LucideProps>> = { bike: Bike, scooter: Scooter, waves: Waves, wind: Wind, map: Map, car: Car };

export function CategoryIcon({ icon, ...props }: { icon: string | null | undefined } & LucideProps) {
  const Icon = (icon && MAP[icon]) || Mountain;
  return <Icon aria-hidden {...props} />;
}
