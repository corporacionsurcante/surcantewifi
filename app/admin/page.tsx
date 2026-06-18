"use client";

import { useState } from "react";
import type { CodigoAcceso } from "@/lib/codigos";

export default function PaginaAdmin() {
  const [clave, setClave] = useState("");
  const [autenticado, setAutenticado] = useState(false);
  const [codigos, setCodigos] = useState<CodigoAcceso[]>([]);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function ingresar() {
    setError(null);
    setCargando(true);
    try {
      const respuesta = await fetch("/api/admin-codigos", {
        headers: { "x-clave-admin": clave },
      });
      if (!respuesta.ok) {
        throw new Error("Clave incorrecta");
      }
      const datos = await respuesta.json();
      setCodigos(datos.codigos);
      setAutenticado(true);
    } catch {
      setError("Clave incorrecta");
    } finally {
      setCargando(false);
    }
  }

  async function crearCodigo() {
    setCargando(true);
    try {
      const respuesta = await fetch("/api/admin-codigos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-clave-admin": clave,
        },
        body: JSON.stringify({ nota }),
      });
      const datos = await respuesta.json();
      setCodigos((actuales) => [datos.codigo, ...actuales]);
      setNota("");
    } finally {
      setCargando(false);
    }
  }

  if (!autenticado) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 py-9">
        <div className="w-full max-w-xs">
          <p className="text-white text-lg font-medium mb-4 text-center">
            Panel de administración
          </p>
          <input
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="Clave de administrador"
            className="w-full px-4 py-3 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-white mb-3"
            onKeyDown={(e) => e.key === "Enter" && ingresar()}
          />
          {error && (
            <p className="text-sm text-red-400 mb-3 text-center">{error}</p>
          )}
          <button
            onClick={ingresar}
            disabled={cargando}
            className="w-full py-3 rounded-xl text-[15px] font-medium bg-[#6E3FA3] hover:bg-[#5A3286] transition disabled:opacity-60"
          >
            {cargando ? "Verificando..." : "Ingresar"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-9">
      <div className="w-full max-w-lg mx-auto">
        <p className="text-white text-lg font-medium mb-5">
          Códigos de acceso libre
        </p>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Para quién es (opcional)"
            className="flex-1 px-3 py-2.5 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-white text-sm"
          />
          <button
            onClick={crearCodigo}
            disabled={cargando}
            className="px-4 py-2.5 rounded-xl text-[14px] font-medium bg-[#6E3FA3] hover:bg-[#5A3286] transition disabled:opacity-60 whitespace-nowrap"
          >
            Generar código
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {codigos.length === 0 && (
            <p className="text-[#A0A0A8] text-sm text-center py-6">
              Todavía no generaste ningún código.
            </p>
          )}
          {codigos.map((c) => (
            <FilaCodigo key={c.codigo} codigo={c} />
          ))}
        </div>
      </div>
    </main>
  );
}

function FilaCodigo({ codigo }: { codigo: CodigoAcceso }) {
  const usado = codigo.usadoEn !== null;
  return (
    <div className="flex items-center justify-between rounded-xl px-4 py-3 bg-[#18181B] border border-[#2A2A2E]">
      <div>
        <p className="text-white font-mono text-[15px] tracking-wide">
          {codigo.codigo}
        </p>
        {codigo.nota && (
          <p className="text-[#A0A0A8] text-[12px] mt-0.5">{codigo.nota}</p>
        )}
      </div>
      <span
        className={`text-[11px] px-2.5 py-1 rounded-md font-medium ${
          usado
            ? "bg-[#412402] text-[#EF9F27]"
            : "bg-[#04342C] text-[#5DCAA5]"
        }`}
      >
        {usado ? "Usado" : "Disponible"}
      </span>
    </div>
  );
}
