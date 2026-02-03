"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Truck, Plus, X, Camera, LogOut, ArrowLeft, RefreshCw, Edit2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Carroceria = "camion_con_carro" | "carro_reefer" | "camara_de_frio" | "camion_paquetero";

type ExistingTruck = {
  id: number;
  patente: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  carroceria: string | null;
  foto_url?: string | null;
};

const CARROCERIAS: { value: Carroceria; label: string }[] = [
  { value: "camion_con_carro", label: "Camión con carro" },
  { value: "carro_reefer", label: "Carro reefer" },
  { value: "camara_de_frio", label: "Cámara de frío" },
  { value: "camion_paquetero", label: "Camión paquetero" },
];

function normalizePatente(x: string) {
  return String(x || "").replace(/\s+/g, "").toUpperCase();
}

export function FleetForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [loadingEmpresa, setLoadingEmpresa] = useState(true);

  const [existing, setExisting] = useState<ExistingTruck[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Para editar camión existente
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ marca: "", modelo: "", anio: "", carroceria: "" });

  // Para agregar nuevo camión (uno a la vez)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTruck, setNewTruck] = useState({
    patente: "",
    carroceria: "camion_con_carro" as Carroceria,
    marca: "",
    modelo: "",
    anio: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoadingEmpresa(true);
        const res = await fetch("/api/cliente/me", { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "No autenticado. Vuelve a ingresar con tu RUT y PIN.");
        }

        setEmpresaId(Number(data.empresaId));
      } catch (e) {
        toast({
          title: "Sesión de cliente",
          description: e instanceof Error ? e.message : "No autenticado",
          variant: "destructive",
        });
        router.push("/cliente/ingresar");
      } finally {
        setLoadingEmpresa(false);
      }
    })();
  }, [router, toast]);

  const loadExisting = async (eid: number) => {
    try {
      setLoadingExisting(true);
      const res = await fetch(`/api/fleet?empresaId=${eid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al cargar camiones");
      setExisting(data?.trucks ?? []);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudieron cargar camiones",
        variant: "destructive",
      });
    } finally {
      setLoadingExisting(false);
    }
  };

  useEffect(() => {
    if (!empresaId) return;
    loadExisting(empresaId);
  }, [empresaId]);

  // Agregar un camión nuevo
  const handleAddTruck = async () => {
    const patente = normalizePatente(newTruck.patente);
    if (!patente) {
      toast({ title: "Error", description: "Ingresa la patente", variant: "destructive" });
      return;
    }

    // Verificar si ya existe
    if (existing.some(t => normalizePatente(t.patente) === patente)) {
      toast({ title: "Error", description: "Esta patente ya está registrada", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId,
          camiones: [{
            patente,
            carroceria: newTruck.carroceria,
            marca: newTruck.marca.trim() || null,
            modelo: newTruck.modelo.trim() || null,
            anio: newTruck.anio ? Number(newTruck.anio) : null,
            tipo: "camion",
          }],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al guardar");

      toast({ title: "Camión agregado", description: `Patente ${patente} registrada exitosamente` });

      // Reset form
      setNewTruck({ patente: "", carroceria: "camion_con_carro", marca: "", modelo: "", anio: "" });
      setShowAddForm(false);

      if (empresaId) await loadExisting(empresaId);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Error inesperado",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Iniciar edición
  const startEdit = (t: ExistingTruck) => {
    setEditingId(t.id);
    setEditForm({
      marca: t.marca || "",
      modelo: t.modelo || "",
      anio: t.anio ? String(t.anio) : "",
      carroceria: t.carroceria || "camion_con_carro",
    });
  };

  // Guardar edición
  const saveEdit = async (t: ExistingTruck) => {
    try {
      const res = await fetch("/api/fleet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          truckId: t.id,
          marca: editForm.marca.trim() || null,
          modelo: editForm.modelo.trim() || null,
          anio: editForm.anio ? Number(editForm.anio) : null,
          carroceria: editForm.carroceria,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo actualizar");

      toast({ title: "Actualizado", description: `Camión ${t.patente} actualizado` });
      setEditingId(null);

      if (empresaId) await loadExisting(empresaId);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/cliente/logout", { method: "POST", credentials: "include" });
    } finally {
      router.replace("/cliente");
      router.refresh();
    }
  };

  if (loadingEmpresa) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "300px" }}>
        <p style={{ color: "#666" }}>Cargando sesión...</p>
      </div>
    );
  }

  if (!empresaId) {
    return (
      <div style={{ textAlign: "center", padding: "3rem" }}>
        <p style={{ color: "#dc2626", marginBottom: "1rem" }}>No se pudo identificar la empresa.</p>
        <Link href="/cliente/ingresar" style={{ color: "var(--primary)", fontWeight: 600 }}>
          Ir a ingresar
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <button
          onClick={() => router.push("/cliente")}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "none", border: "none", cursor: "pointer", color: "#666" }}
        >
          <ArrowLeft size={20} />
          <span>Volver</span>
        </button>
        <button
          onClick={handleLogout}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "none", border: "1px solid #ddd", borderRadius: "8px", padding: "0.5rem 1rem", cursor: "pointer", color: "#666" }}
        >
          <LogOut size={16} />
          <span>Cerrar sesión</span>
        </button>
      </div>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#121212", marginBottom: "0.5rem" }}>
          Mi Flota
        </h1>
        <p style={{ color: "#666" }}>Administra los camiones de tu empresa</p>
      </div>

      {/* Lista de camiones existentes */}
      <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e5e5e5", padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "600" }}>Camiones registrados ({existing.length})</h2>
          <button
            onClick={() => empresaId && loadExisting(empresaId)}
            disabled={loadingExisting}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "none", border: "1px solid #ddd", borderRadius: "6px", padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.85rem" }}
          >
            <RefreshCw size={14} className={loadingExisting ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        {existing.length === 0 ? (
          <p style={{ color: "#999", textAlign: "center", padding: "2rem 0" }}>
            Aún no tienes camiones registrados
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {existing.map((t) => (
              <div
                key={t.id}
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  padding: "1rem",
                  background: editingId === t.id ? "#f9f9f9" : "white",
                }}
              >
                {editingId === t.id ? (
                  // Modo edición
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <span style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{t.patente}</span>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          onClick={() => saveEdit(t)}
                          style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: "6px", padding: "0.4rem 0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem" }}
                        >
                          <Check size={14} /> Guardar
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{ background: "#f3f3f3", border: "none", borderRadius: "6px", padding: "0.4rem 0.8rem", cursor: "pointer" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      <div>
                        <label style={{ fontSize: "0.8rem", color: "#666", display: "block", marginBottom: "0.25rem" }}>Marca</label>
                        <input
                          type="text"
                          value={editForm.marca}
                          onChange={(e) => setEditForm(p => ({ ...p, marca: e.target.value }))}
                          placeholder="Volvo"
                          style={{ width: "100%", padding: "0.6rem", border: "1px solid #ddd", borderRadius: "6px" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.8rem", color: "#666", display: "block", marginBottom: "0.25rem" }}>Modelo</label>
                        <input
                          type="text"
                          value={editForm.modelo}
                          onChange={(e) => setEditForm(p => ({ ...p, modelo: e.target.value }))}
                          placeholder="FH16"
                          style={{ width: "100%", padding: "0.6rem", border: "1px solid #ddd", borderRadius: "6px" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.8rem", color: "#666", display: "block", marginBottom: "0.25rem" }}>Año</label>
                        <input
                          type="text"
                          value={editForm.anio}
                          onChange={(e) => setEditForm(p => ({ ...p, anio: e.target.value }))}
                          placeholder="2020"
                          inputMode="numeric"
                          style={{ width: "100%", padding: "0.6rem", border: "1px solid #ddd", borderRadius: "6px" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.8rem", color: "#666", display: "block", marginBottom: "0.25rem" }}>Carrocería</label>
                        <select
                          value={editForm.carroceria}
                          onChange={(e) => setEditForm(p => ({ ...p, carroceria: e.target.value }))}
                          style={{ width: "100%", padding: "0.6rem", border: "1px solid #ddd", borderRadius: "6px" }}
                        >
                          {CARROCERIAS.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Modo vista
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: "bold", fontSize: "1.1rem", marginRight: "1rem" }}>{t.patente}</span>
                      <span style={{ color: "#666", fontSize: "0.9rem" }}>
                        {[t.marca, t.modelo, t.anio].filter(Boolean).join(" · ") || "Sin detalles"}
                      </span>
                    </div>
                    <button
                      onClick={() => startEdit(t)}
                      style={{ background: "none", border: "1px solid #ddd", borderRadius: "6px", padding: "0.4rem 0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}
                    >
                      <Edit2 size={14} /> Editar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agregar nuevo camión */}
      <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e5e5e5", padding: "1.5rem" }}>
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "1rem",
              background: "none",
              border: "2px dashed #ddd",
              borderRadius: "8px",
              cursor: "pointer",
              color: "#666",
              fontSize: "1rem",
            }}
          >
            <Plus size={20} />
            Agregar camión
          </button>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600" }}>Nuevo camión</h3>
              <button
                onClick={() => setShowAddForm(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: "500", display: "block", marginBottom: "0.4rem" }}>
                  Patente *
                </label>
                <input
                  type="text"
                  value={newTruck.patente}
                  onChange={(e) => setNewTruck(p => ({ ...p, patente: e.target.value.toUpperCase() }))}
                  placeholder="ABCD12"
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "8px", fontSize: "1rem" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: "500", display: "block", marginBottom: "0.4rem" }}>
                  Tipo de carrocería
                </label>
                <select
                  value={newTruck.carroceria}
                  onChange={(e) => setNewTruck(p => ({ ...p, carroceria: e.target.value as Carroceria }))}
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "8px", fontSize: "1rem" }}
                >
                  {CARROCERIAS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: "500", display: "block", marginBottom: "0.4rem" }}>
                    Marca
                  </label>
                  <input
                    type="text"
                    value={newTruck.marca}
                    onChange={(e) => setNewTruck(p => ({ ...p, marca: e.target.value }))}
                    placeholder="Volvo"
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "8px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: "500", display: "block", marginBottom: "0.4rem" }}>
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={newTruck.modelo}
                    onChange={(e) => setNewTruck(p => ({ ...p, modelo: e.target.value }))}
                    placeholder="FH16"
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "8px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: "500", display: "block", marginBottom: "0.4rem" }}>
                    Año
                  </label>
                  <input
                    type="text"
                    value={newTruck.anio}
                    onChange={(e) => setNewTruck(p => ({ ...p, anio: e.target.value }))}
                    placeholder="2020"
                    inputMode="numeric"
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "8px" }}
                  />
                </div>
              </div>

              <button
                onClick={handleAddTruck}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "1rem",
                  background: "var(--primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  marginTop: "0.5rem",
                }}
              >
                {saving ? "Guardando..." : "Agregar camión"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
