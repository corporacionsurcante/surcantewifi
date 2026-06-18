"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buscarPlan } from "@/lib/planes";

export default function PaginaPagado() {
  return (
    <Suspense fallback={null}>
      <ContenidoPagado />
    </Suspense>
  );
}

function ContenidoPagado() {
  const parametros = useSearchParams();
  const planId = parametros.get("plan") ?? "";
  const esDemo = parametros.get("demo") === "true";
  const esCodigo = parametros.get("codigo") === "true";
  const plan = buscarPlan(planId);

  const [segundosRestantes, setSegundosRestantes] = useState(
    esCodigo ? -1 : plan ? plan.duracionMinutos * 60 : 0
  );

  useEffect(() => {
    if (esCodigo) return;
    const intervalo = setInterval(() => {
      setSegundosRestantes((actual) => Math.max(0, actual - 1));
    }, 1000);
    return () => clearInterval(intervalo);
  }, [esCodigo]);

  if (esCodigo) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 py-9 text-center">
        <div className="w-full max-w-sm">
          <div className="w-16 h-16 rounded-full bg-[#1D9E75]/15 flex items-center justify-center mx-auto mb-5">
            <span className="text-[#5DCAA5] text-3xl">✓</span>
          </div>
          <p className="text-white text-xl font-medium mb-2">
            Ya estás conectado
          </p>
          <p className="text-[#A0A0A8] text-[14px]">
            Tu código de acceso fue activado. Disfrutá el viaje.
          </p>
        </div>
      </main>
    );
  }

  const sinTiempo = segundosRestantes <= 0;
  const porVencer = segundosRestantes > 0 && segundosRestantes <= 15 * 60;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-9 text-center">
      <div className="w-full max-w-sm">
        {sinTiempo ? (
          <PantallaVencido esDemo={esDemo} />
        ) : (
          <PantallaActiva
            plan={plan?.nombre ?? "tu plan"}
            segundosRestantes={segundosRestantes}
            porVencer={porVencer}
            esDemo={esDemo}
          />
        )}
      </div>
    </main>
  );
}

function PantallaActiva({
  plan,
  segundosRestantes,
  porVencer,
  esDemo,
}: {
  plan: string;
  segundosRestantes: number;
  porVencer: boolean;
  esDemo: boolean;
}) {
  return (
    <>
      <div className="w-16 h-16 rounded-full bg-[#1D9E75]/15 flex items-center justify-center mx-auto mb-5">
        <span className="text-[#5DCAA5] text-3xl">✓</span>
      </div>
      <p className="text-white text-xl font-medium mb-2">Ya estás conectado</p>
      <p className="text-[#A0A0A8] text-[14px] mb-5">
        Activamos tu {plan}. Disfrutá el viaje.
      </p>

      <div
        className={`rounded-xl px-4 py-3 mb-5 ${
          porVencer ? "bg-[#412402]" : "bg-[#18181B]"
        }`}
      >
        <p
          className={`text-[12px] mb-1 ${
            porVencer ? "text-[#EF9F27]" : "text-[#A0A0A8]"
          }`}
        >
          Tiempo restante
        </p>
        <p className="text-white text-2xl font-medium">
          {formatearTiempo(segundosRestantes)}
        </p>
      </div>

      {porVencer && (
        <a
          href="/"
          className="block w-full py-3.5 rounded-xl text-[15px] font-medium bg-[#6E3FA3] hover:bg-[#5A3286] active:scale-[0.98] transition mb-4"
        >
          Sumar más tiempo
        </a>
      )}

      {esDemo && (
        <p className="text-[12px] text-[#8B5FBF] bg-[#211A2B] rounded-lg px-3 py-2">
          Esta es una simulación de prueba. Todavía no se procesó ningún pago
          real.
        </p>
      )}
    </>
  );
}

function PantallaVencido({ esDemo }: { esDemo: boolean }) {
  return (
    <>
      <div className="w-16 h-16 rounded-full bg-[#412402] flex items-center justify-center mx-auto mb-5">
        <span className="text-[#EF9F27] text-3xl">!</span>
      </div>
      <p className="text-white text-xl font-medium mb-2">
        Tu tiempo se terminó
      </p>
      <p className="text-[#A0A0A8] text-[14px] mb-6">
        Elegí un nuevo pack para seguir conectado.
      </p>
      <a
        href="/"
        className="block w-full py-3.5 rounded-xl text-[15px] font-medium bg-[#6E3FA3] hover:bg-[#5A3286] active:scale-[0.98] transition"
      >
        Ver planes
      </a>

      {esDemo && (
        <p className="text-[12px] text-[#8B5FBF] bg-[#211A2B] rounded-lg px-3 py-2 mt-4">
          Esta es una simulación de prueba. Todavía no se procesó ningún pago
          real.
        </p>
      )}
    </>
  );
}

function formatearTiempo(segundosTotales: number): string {
  const horas = Math.floor(segundosTotales / 3600);
  const minutos = Math.floor((segundosTotales % 3600) / 60);
  const segundos = segundosTotales % 60;

  if (horas > 0) {
    return `${horas}h ${String(minutos).padStart(2, "0")}m`;
  }
  return `${minutos}:${String(segundos).padStart(2, "0")}`;
}
