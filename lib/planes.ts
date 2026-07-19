export type Plan = {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  duracionMinutos: number;
  activo: boolean;
  descuento: number;
  creadoEn?: number;
  actualizadoEn?: number;
};

export const PLANES_PREDETERMINADOS: Plan[] = [
  {
    id: "pack-6h",
    nombre: "Pack 6 horas",
    descripcion: "Ideal para tramos cortos y medios",
    precio: 5000,
    duracionMinutos: 360,
    activo: true,
    descuento: 0,
    creadoEn: Date.now(),
    actualizadoEn: Date.now(),
  },
  {
    id: "pack-12h",
    nombre: "Pack 12 horas",
    descripcion: "Para viajes de media distancia",
    precio: 8000,
    duracionMinutos: 720,
    activo: true,
    descuento: 0,
    creadoEn: Date.now(),
    actualizadoEn: Date.now(),
  },
  {
    id: "pack-24h",
    nombre: "Pack 24 horas",
    descripcion: "Para los viajes más largos",
    precio: 12000,
    duracionMinutos: 1440,
    activo: true,
    descuento: 0,
    creadoEn: Date.now(),
    actualizadoEn: Date.now(),
  },
];

// Para compatibilidad con código existente
export const PLANES: Plan[] = PLANES_PREDETERMINADOS;

export function buscarPlan(id: string, planes?: Plan[]): Plan | undefined {
  const listaPlan = planes || PLANES;
  return listaPlan.find((plan) => plan.id === id);
}

export function obtenerPlanesActivos(planes?: Plan[]): Plan[] {
  const listaPlan = planes || PLANES;
  return listaPlan.filter((plan) => plan.activo);
}
