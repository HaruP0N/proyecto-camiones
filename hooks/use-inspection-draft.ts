import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";

export interface InspectionDraftData {
  // Fase 1: Validación Camión
  camionFoto?: string; // base64 o URL
  patente?: string;
  patenteValidada?: boolean;
  choferNombre?: string;
  choferRUT?: string;
  choferEdad?: string;
  choferApreciacion?: string;
  direccion?: string;

  // Fase 2: Validación Carrocería
  carroceriaFoto?: string;
  carroceriaValidada?: boolean;

  // Fase 3: Ítems de inspección
  items?: Record<
    string,
    {
      estado: "ok" | "falla" | "na";
      comentario?: string;
      fotos?: string[];
    }
  >;

  // Metadata
  createdAt?: number;
  updatedAt?: number;
}

export function useInspectionDraft(camionId: string) {
  const { toast } = useToast();
  const LOCAL_KEY = `inspeccion-draft-${camionId}`;

  const [draft, setDraft] = useState<InspectionDraftData>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(LOCAL_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return {
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guardar en localStorage
  const saveLocal = (data: InspectionDraftData, showToast = true) => {
    try {
      const toSave = {
        ...data,
        updatedAt: Date.now(),
      };
      localStorage.setItem(LOCAL_KEY, JSON.stringify(toSave));
      if (showToast) {
        toast({
          title: "Guardado automáticamente",
          description: "Borrador local actualizado",
        });
      }
      setHasUnsavedChanges(false);
    } catch (e) {
      console.error("Error saving draft:", e);
    }
  };

  // Guardar cada 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedChanges) {
        saveLocal(draft, false);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [draft, hasUnsavedChanges]);

  // Guardar antes de descargar/navegar
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (draft) saveLocal(draft, false);
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "Tienes cambios sin guardar.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [draft, hasUnsavedChanges]);

  // Restaurar borrador al abrir
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(LOCAL_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setDraft(parsed);
          toast({
            title: "Borrador restaurado",
            description: "Se cargó el borrador local",
          });
        } catch {}
      }
    }
  }, []);

  // Actualizar draft con debounce 2s
  const updateDraft = (newData: Partial<InspectionDraftData>) => {
    const updated = { ...draft, ...newData };
    setDraft(updated);
    setHasUnsavedChanges(true);

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      saveLocal(updated);
    }, 2000);
  };

  // Limpiar borrador (después de enviar exitosamente)
  const clearDraft = () => {
    localStorage.removeItem(LOCAL_KEY);
    setDraft({
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setHasUnsavedChanges(false);
  };

  return {
    draft,
    updateDraft,
    saveLocal,
    clearDraft,
    hasUnsavedChanges,
  };
}
