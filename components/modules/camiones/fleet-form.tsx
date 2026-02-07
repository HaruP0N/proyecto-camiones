"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Carroceria = "CAMION_CON_CARRO" | "CARRO_REEFER" | "CAMARA_DE_FRIO" | "CAMION_PAQUETERO";

type ExistingTruck = {
  id: number;
  patente: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  carroceria: Carroceria | null;
  foto_url?: string | null;
};

// Estado de edición tipado para inputs (strings)
type EditPatch = {
  marca?: string;
  modelo?: string;
  anio?: string;
  carroceria?: Carroceria;
};

type TruckRow = {
  patente: string;
  carroceria: Carroceria;
  marca: string;
  modelo: string;
  anio: string;
};

type PhotoState = { file: File; previewUrl: string };

const CARROCERIAS: { value: Carroceria; label: string }[] = [
  { value: "CAMION_CON_CARRO", label: "Camión con carro" },
  { value: "CARRO_REEFER", label: "Carro reefer" },
  { value: "CAMARA_DE_FRIO", label: "Cámara de frío" },
  { value: "CAMION_PAQUETERO", label: "Camión paquetero" },
];

function normalizePatente(x: string) {
  return String(x || "").replace(/\s+/g, "").toUpperCase();
}

function parseYearOrNull(s: string): number | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1900 || n > 2100) return null;
  return n;
}

export function FleetForm() {
  const router = useRouter();
  const { toast } = useToast();

  // ✅ empresaId ahora viene desde cookie (via /api/cliente/me)
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [loadingEmpresa, setLoadingEmpresa] = useState(true);

  // -------- existentes --------
  const [existing, setExisting] = useState<ExistingTruck[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const [editById, setEditById] = useState<Record<number, EditPatch>>({});

  // fotos seleccionadas para existentes (key=truckId)
  const [photoExisting, setPhotoExisting] = useState<Record<number, PhotoState | undefined>>({});
  const fileRefsExisting = useRef<Record<number, HTMLInputElement | null>>({});

  // -------- nuevos --------
  const [defaultCarroceria, setDefaultCarroceria] = useState<Carroceria>("CAMION_CON_CARRO");
  const [paste, setPaste] = useState("");
  const [rows, setRows] = useState<TruckRow[]>([]);
  const [saving, setSaving] = useState(false);

  // fotos para nuevos (key = patente normalizada)
  const [photoNewByPatente, setPhotoNewByPatente] = useState<Record<string, PhotoState | undefined>>({});
  const fileRefsNew = useRef<Record<string, HTMLInputElement | null>>({});

  // ✅ 1) Cargar empresaId desde cookie
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
        // Te mando a ingresar (ya no pedimos empresaId)
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

  // ✅ 2) Cuando ya tengo empresaId, cargo camiones
  useEffect(() => {
    if (!empresaId) return;
    loadExisting(empresaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const duplicatesInForm = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const p = normalizePatente(r.patente);
      if (!p) continue;
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return new Set(Array.from(counts.entries()).filter(([, c]) => c > 1).map(([p]) => p));
  }, [rows]);

  const handleGenerateRows = () => {
    const patentes = paste
      .split(/\r?\n/)
      .map((x) => normalizePatente(x))
      .filter(Boolean);

    if (patentes.length === 0) {
      toast({ title: "Sin patentes", description: "Pega al menos una patente.", variant: "destructive" });
      return;
    }

    const existingInDB = new Set(existing.map((t) => normalizePatente(t.patente)));
    const existingInForm = new Set(rows.map((r) => normalizePatente(r.patente)));

    const toAdd = patentes.filter((p) => !existingInForm.has(p));
    const alreadyDB = toAdd.filter((p) => existingInDB.has(p));
    const reallyNew = toAdd.filter((p) => !existingInDB.has(p));

    if (alreadyDB.length > 0) {
      toast({
        title: "Patentes ya registradas",
        description: `Se omiten: ${alreadyDB.join(", ")}`,
        variant: "destructive",
      });
    }

    if (reallyNew.length === 0) {
      setPaste("");
      return;
    }

    setRows((prev) => [
      ...prev,
      ...reallyNew.map((p) => ({
        patente: p,
        carroceria: defaultCarroceria,
        marca: "",
        modelo: "",
        anio: "",
      })),
    ]);

    setPaste("");
  };

  const updateRow = (idx: number, patch: Partial<TruckRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRow = (idx: number) => {
    const patente = normalizePatente(rows[idx]?.patente || "");
    const prev = photoNewByPatente[patente];
    if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);

    setPhotoNewByPatente((p) => {
      const copy = { ...p };
      delete copy[patente];
      return copy;
    });

    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // --- foto helpers ---
  const pickPhotoNew = (patente: string, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo inválido", description: "Debe ser una imagen.", variant: "destructive" });
      return;
    }
    const key = normalizePatente(patente);
    const previewUrl = URL.createObjectURL(file);

    const prev = photoNewByPatente[key];
    if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);

    setPhotoNewByPatente((p) => ({ ...p, [key]: { file, previewUrl } }));
  };

  const openPickerNew = (patente: string) => {
    const key = normalizePatente(patente);
    const input = fileRefsNew.current[key];
    if (!input) return;
    input.click();
  };

  const pickPhotoExisting = (truckId: number, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo inválido", description: "Debe ser una imagen.", variant: "destructive" });
      return;
    }
    const previewUrl = URL.createObjectURL(file);

    const prev = photoExisting[truckId];
    if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);

    setPhotoExisting((p) => ({ ...p, [truckId]: { file, previewUrl } }));
  };

  const openPickerExisting = (truckId: number) => {
    const input = fileRefsExisting.current[truckId];
    if (!input) return;
    input.click();
  };

  // --- validar ---
  const validate = () => {
    if (!empresaId) return "No se pudo identificar la empresa (sesión).";
    if (rows.length === 0) return "Debes agregar al menos un camión.";

    for (const r of rows) {
      if (!normalizePatente(r.patente)) return "Hay una patente vacía.";
      if (r.anio && parseYearOrNull(r.anio) === null) return `Año inválido en patente ${r.patente}`;
    }

    if (duplicatesInForm.size > 0) return `Patentes duplicadas: ${Array.from(duplicatesInForm).join(", ")}`;
    return null;
  };

  // --- guardar nuevos camiones + fotos placeholder ---
  const handleSaveNew = async () => {
    const err = validate();
    if (err) {
      toast({ title: "Error", description: err, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        empresaId: Number(empresaId),
        camiones: rows.map((r) => ({
          patente: normalizePatente(r.patente),
          carroceria: r.carroceria,
          marca: r.marca.trim() || null,
          modelo: r.modelo.trim() || null,
          anio: r.anio ? Number(r.anio) : null,
          tipo: "camion",
        })),
      };

      const res = await fetch("/api/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al guardar flota");

      const insertedTrucks: Array<{ id: number; patente: string }> = data?.insertedTrucks ?? [];
      const duplicates: string[] = data?.duplicates ?? [];

      for (const it of insertedTrucks) {
        const key = normalizePatente(it.patente);
        const photo = photoNewByPatente[key];
        if (!photo) continue;

        const fakeUrl = `pending-upload://${key}`;

        const r2 = await fetch("/api/truck-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ camionId: it.id, url: fakeUrl }),
        });
        const d2 = await r2.json();
        if (!r2.ok) throw new Error(d2?.error || `Error guardando foto de ${key}`);
      }

      toast({
        title: "Flota actualizada",
        description: duplicates.length
          ? `Insertados: ${insertedTrucks.length}. Duplicados omitidos: ${duplicates.join(", ")}`
          : `Insertados: ${insertedTrucks.length}.`,
      });

      rows.forEach((r) => {
        const key = normalizePatente(r.patente);
        const prev = photoNewByPatente[key];
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      });
      setRows([]);
      setPhotoNewByPatente({});

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

  // --- guardar edición de existente ---
  const saveExistingRow = async (t: ExistingTruck) => {
    const patch = editById[t.id] ?? {};

    const marca = patch.marca !== undefined ? patch.marca : (t.marca ?? "");
    const modelo = patch.modelo !== undefined ? patch.modelo : (t.modelo ?? "");
    const carroceria = patch.carroceria !== undefined ? patch.carroceria : (t.carroceria ?? "CAMION_CON_CARRO");

    const anioStr = patch.anio !== undefined ? patch.anio : (t.anio !== null ? String(t.anio) : "");
    if (anioStr.trim() !== "" && parseYearOrNull(anioStr) === null) {
      toast({ title: "Error", description: "Año inválido (1900–2100).", variant: "destructive" });
      return;
    }
    const anio = parseYearOrNull(anioStr);

    try {
      const res = await fetch("/api/fleet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          truckId: t.id,
          marca: marca.trim() || null,
          modelo: modelo.trim() || null,
          anio,
          carroceria,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo actualizar el camión");

      toast({ title: "Actualizado", description: `Camión ${t.patente} actualizado.` });
      setEditById((p) => {
        const copy = { ...p };
        delete copy[t.id];
        return copy;
      });

      if (empresaId) await loadExisting(empresaId);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  // --- guardar foto existente (placeholder) ---
  const saveExistingPhoto = async (t: ExistingTruck) => {
    const photo = photoExisting[t.id];
    if (!photo) {
      toast({ title: "Falta foto", description: "Selecciona una foto primero.", variant: "destructive" });
      return;
    }

    try {
      const fakeUrl = `pending-upload://${normalizePatente(t.patente)}`;

      const res = await fetch("/api/truck-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camionId: t.id, url: fakeUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar la foto");

      toast({ title: "Foto registrada", description: `Foto guardada para ${t.patente} (placeholder).` });

      if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
      setPhotoExisting((p) => {
        const copy = { ...p };
        delete copy[t.id];
        return copy;
      });

      if (empresaId) await loadExisting(empresaId);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  // --- render estados ---
  if (loadingEmpresa) return <div className="p-4">Cargando sesión de cliente...</div>;
  if (!empresaId) return <div className="p-4 text-red-600">No se pudo identificar la empresa. Vuelve a ingresar.</div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Volver al Inicio */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" onClick={() => router.push("/cliente")}>
          Volver al Inicio
        </Button>
        <Button variant="outline" type="button" onClick={async () => {
          try {
            await fetch("/api/cliente/logout", {
              method: "POST",
              credentials: "include",  
            });
          } finally {
            router.replace("/");
            router.refresh();
          }
        }}
        >
          Cerrar sesión
        </Button>  
      </div>

      {/* Camiones Registrados */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Camiones Registrados</h2>
        {/* Tabla para desktop */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 text-left">Patente</th>
                <th className="p-2 text-left">Marca</th>
                <th className="p-2 text-left">Modelo</th>
                <th className="p-2 text-left">Año</th>
                <th className="p-2 text-left">Carrocería</th>
                <th className="p-2 text-left">Foto</th>
                <th className="p-2 text-left">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {existing.map((t) => {
                const patch = editById[t.id] ?? {};
                const effectiveMarca = patch.marca ?? (t.marca ?? "");
                const effectiveModelo = patch.modelo ?? (t.modelo ?? "");
                const effectiveAnio = patch.anio ?? (t.anio !== null ? String(t.anio) : "");
                const effectiveCarroceria = (patch.carroceria ?? (t.carroceria ?? "CAMION_CON_CARRO")) as Carroceria;

                const photo = photoExisting[t.id];

                return (
                  <tr key={t.id} className="border-t align-top">
                    <td className="p-2 font-medium">{t.patente}</td>

                    <td className="p-2 min-w-[160px]">
                      <Input
                        value={effectiveMarca}
                        onChange={(e) =>
                          setEditById((p) => ({
                            ...p,
                            [t.id]: { ...(p[t.id] ?? {}), marca: e.target.value },
                          }))
                        }
                      />
                    </td>

                    <td className="p-2 min-w-[160px]">
                      <Input
                        value={effectiveModelo}
                        onChange={(e) =>
                          setEditById((p) => ({
                            ...p,
                            [t.id]: { ...(p[t.id] ?? {}), modelo: e.target.value },
                          }))
                        }
                      />
                    </td>

                    <td className="p-2 min-w-[110px]">
                      <Input
                        value={effectiveAnio}
                        inputMode="numeric"
                        placeholder="2020"
                        onChange={(e) =>
                          setEditById((p) => ({
                            ...p,
                            [t.id]: { ...(p[t.id] ?? {}), anio: e.target.value },
                          }))
                        }
                      />
                    </td>

                    <td className="p-2 min-w-[190px]">
                      <select
                        className="w-full h-10 rounded-md border px-2"
                        value={effectiveCarroceria}
                        onChange={(e) =>
                          setEditById((p) => ({
                            ...p,
                            [t.id]: { ...(p[t.id] ?? {}), carroceria: e.target.value as Carroceria },
                          }))
                        }
                      >
                        {CARROCERIAS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-2 min-w-[240px] space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{t.foto_url ? "✅ registrada" : "— sin foto"}</span>
                        <Button type="button" variant="outline" onClick={() => openPickerExisting(t.id)}>
                          {photo ? "Cambiar" : "Seleccionar"}
                        </Button>
                      </div>

                      {photo ? (
                        <div className="relative w-full h-32 rounded-md overflow-hidden border">
                          <Image
                            src={photo.previewUrl}
                            alt={`Foto ${t.patente}`}
                            fill
                            className="object-contain bg-white"
                          />
                        </div>
                      ) : null}

                      <input
                        ref={(el) => {
                          fileRefsExisting.current[t.id] = el;
                        }}
                        className="hidden"
                        type="file"
                        accept="image/*"
                        onChange={(e) => pickPhotoExisting(t.id, e.target.files?.[0] ?? null)}
                      />

                      <Button type="button" className="w-full" onClick={() => saveExistingPhoto(t)}>
                        Guardar foto
                      </Button>
                    </td>

                    <td className="p-2 min-w-[160px]">
                      <Button type="button" className="w-full" onClick={() => saveExistingRow(t)}>
                        Guardar cambios
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Cards para mobile */}
        <div className="block md:hidden space-y-3">
          {existing.length === 0 ? (
            <div className="text-muted-foreground text-sm">No hay camiones registrados.</div>
          ) : (
            existing.map((truck) => (
              <Card key={truck.id}>
                <CardHeader>
                  <CardTitle>{truck.patente}</CardTitle>
                  <CardDescription>
                    {truck.marca || "-"} {truck.modelo || "-"} ({truck.anio || "-"})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-1">
                    <span><b>Carrocería:</b> {truck.carroceria ? CARROCERIAS.find(c => c.value === truck.carroceria)?.label : "-"}</span>
                    {/* Foto si existe */}
                    {truck.foto_url && (
                      <Image src={truck.foto_url} alt="Foto" width={80} height={60} className="rounded" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Nuevos Camiones */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Nuevos Camiones</h2>
        {/* Tabla para desktop */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 text-left">Patente</th>
                <th className="p-2 text-left">Carrocería</th>
                <th className="p-2 text-left">Marca</th>
                <th className="p-2 text-left">Modelo</th>
                <th className="p-2 text-left">Año</th>
                <th className="p-2 text-left">Foto</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {rows.map((r, i) => {
                const key = normalizePatente(r.patente);
                const isDup = duplicatesInForm.has(key);
                const photo = photoNewByPatente[key];

                return (
                  <tr key={i} className={isDup ? "bg-red-50" : "border-t align-top"}>
                    <td className="p-2 min-w-[140px]">
                      <Input
                        value={r.patente}
                        onChange={(e) => updateRow(i, { patente: e.target.value })}
                        className={isDup ? "border-red-400" : ""}
                      />
                    </td>

                    <td className="p-2 min-w-[190px]">
                      <select
                        className="w-full h-10 rounded-md border px-2"
                        value={r.carroceria}
                        onChange={(e) => updateRow(i, { carroceria: e.target.value as Carroceria })}
                      >
                        {CARROCERIAS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-2 min-w-[160px]">
                      <Input value={r.marca} onChange={(e) => updateRow(i, { marca: e.target.value })} />
                    </td>

                    <td className="p-2 min-w-[160px]">
                      <Input value={r.modelo} onChange={(e) => updateRow(i, { modelo: e.target.value })} />
                    </td>

                    <td className="p-2 min-w-[110px]">
                      <Input
                        value={r.anio}
                        inputMode="numeric"
                        placeholder="2020"
                        onChange={(e) => updateRow(i, { anio: e.target.value })}
                      />
                    </td>

                    <td className="p-2 min-w-[240px] space-y-2">
                      <Button type="button" variant="outline" onClick={() => openPickerNew(r.patente)}>
                        {photo ? "Cambiar foto" : "Agregar foto"}
                      </Button>

                      {photo ? (
                        <div className="relative w-full h-32 rounded-md overflow-hidden border">
                          <Image src={photo.previewUrl} alt={`Foto ${key}`} fill className="object-contain bg-white" />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Opcional: puedes agregar foto ahora o después.
                        </p>
                      )}

                      <input
                        ref={(el) => {
                          fileRefsNew.current[key] = el;
                        }}
                        className="hidden"
                        type="file"
                        accept="image/*"
                        onChange={(e) => pickPhotoNew(r.patente, e.target.files?.[0] ?? null)}
                      />
                    </td>

                    <td className="p-2">
                      <Button variant="outline" type="button" onClick={() => removeRow(i)}>
                        Quitar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Cards para mobile */}
        <div className="block md:hidden space-y-3">
          {rows.length === 0 ? (
            <div className="text-muted-foreground text-sm">No hay nuevos camiones en el formulario.</div>
          ) : (
            rows.map((row, idx) => (
              <Card key={row.patente}>
                <CardHeader>
                  <CardTitle>{row.patente}</CardTitle>
                  <CardDescription>
                    {row.marca || "-"} {row.modelo || "-"} ({row.anio || "-"})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-1">
                    <span><b>Carrocería:</b> {CARROCERIAS.find(c => c.value === row.carroceria)?.label}</span>
                    {/* Foto si existe */}
                    {photoNewByPatente[normalizePatente(row.patente)]?.previewUrl && (
                      <Image src={photoNewByPatente[normalizePatente(row.patente)]!.previewUrl} alt="Foto" width={80} height={60} className="rounded" />
                    )}
                    {/* Acciones: editar/eliminar */}
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={() => removeRow(idx)}>
                        Eliminar
                      </Button>
                      {/* ...otros botones si los hay... */}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* ...resto del formulario y lógica... */}
    </div>
  );
}
