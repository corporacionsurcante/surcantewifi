export type Plan = {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  duracionMinutos: number;
};

export const PLANES: Plan[] = [
  {
    id: "pack-6h",
    nombre: "Pack 6 horas",
    descripcion: "Ideal para tramos cortos y medios",
    precio: 5000,
    duracionMinutos: 360,
  },
  {
    id: "pack-12h",
    nombre: "Pack 12 horas",
    descripcion: "Para viajes de media distancia",
    precio: 8000,
    duracionMinutos: 720,
  },
  {
    id: "pack-24h",
    nombre: "Pack 24 horas",
    descripcion: "Para los viajes más largos",
    precio: 12000,
    duracionMinutos: 1440,
  },
];

export function buscarPlan(id: string): Plan | undefined {
  return PLANES.find((plan) => plan.id === id);
}
