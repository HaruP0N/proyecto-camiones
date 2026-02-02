"use client";

import { useState } from "react";
import { Camera, Check, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils-cn";

export interface CamionValidationData {
  foto?: string;
  patente: string;
  patenteVerificada: boolean;
  choferNombre?: string;
  choferRUT?: string;
  choferEdad?: string;
  choferApreciacion?: string;
  direccion?: string;
}

interface CamionValidationPhaseProps {
  patenteBD: string;
  onComplete: (data: CamionValidationData) => void;
  initialData?: CamionValidationData;
}

export function CamionValidationPhase({
  patenteBD,
  onComplete,
  initialData,
}: CamionValidationPhaseProps) {
  const [step, setStep] = useState<"foto" | "patente" | "chofer">("foto");
  const [data, setData] = useState<CamionValidationData>(
    initialData || {
      patente: patenteBD,
      patenteVerificada: false,
    }
  );
  const [fotoPreview, setFotoPreview] = useState<string>(
    initialData?.foto || ""
  );
  const [patenteManual, setPatenteManual] = useState(patenteBD);

  const handleFotoCaptura = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setFotoPreview(base64);
      setData({ ...data, foto: base64 });
      setStep("patente");
    };
    reader.readAsDataURL(file);
  };

  const handlePatenteVerificada = (correcta: boolean) => {
    if (correcta) {
      setData({
        ...data,
        patente: patenteManual,
        patenteVerificada: true,
      });
      setStep("chofer");
    } else {
      // Permitir editar patente
      setData({
        ...data,
        patente: patenteManual,
        patenteVerificada: false,
      });
    }
  };

  const handleChoferDataChange = (field: string, value: string) => {
    setData({
      ...data,
      [field]: value,
    });
  };

  const handleCompleteValidation = () => {
    if (!data.patenteVerificada) {
      // No permitir avanzar sin validar patente
      return;
    }
    onComplete(data);
  };

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-40">
        <div className="px-4 py-3">
          <h1 className="font-semibold text-white text-center">
            Validación de Camión
          </h1>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Paso 1: Foto de Camión */}
        {(step === "foto" || fotoPreview) && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-4">
            <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <Camera className="h-5 w-5 text-red-600" />
              Foto Frontal del Camión
            </h3>

            {!fotoPreview ? (
              <div className="flex gap-3">
                <label className="flex-1">
                  <div className="p-4 bg-red-50 border-2 border-dashed border-red-300 rounded-xl cursor-pointer hover:bg-red-100 transition-colors text-center">
                    <Camera className="h-6 w-6 text-red-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-red-700">
                      Tomar foto
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFotoCaptura}
                    className="hidden"
                  />
                </label>
                <label className="flex-1">
                  <div className="p-4 bg-neutral-50 border-2 border-dashed border-neutral-300 rounded-xl cursor-pointer hover:bg-neutral-100 transition-colors text-center">
                    <p className="text-sm font-medium text-neutral-700">
                      Galería
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFotoCaptura}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <img
                  src={fotoPreview}
                  alt="Foto frontal camión"
                  className="w-full h-64 object-cover rounded-xl"
                />
                <button
                  onClick={() => {
                    setFotoPreview("");
                    setData({ ...data, foto: undefined });
                  }}
                  className="w-full py-2 text-sm text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors"
                >
                  Retomar foto
                </button>
              </div>
            )}
          </div>
        )}

        {/* Paso 2: Validar Patente */}
        {step === "patente" && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-4">
            <h3 className="font-semibold text-neutral-900 mb-3">
              Verificar Patente
            </h3>

            <div className="space-y-3 mb-4">
              <p className="text-sm text-neutral-600">
                Patente en sistema: <strong>{patenteBD}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  ¿Es correcta?
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePatenteVerificada(true)}
                    className="flex-1 py-3 bg-green-100 text-green-700 font-medium rounded-lg hover:bg-green-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="h-5 w-5" />
                    Sí, es correcta
                  </button>
                  <button
                    onClick={() => handlePatenteVerificada(false)}
                    className="flex-1 py-3 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="h-5 w-5" />
                    No, es otra
                  </button>
                </div>
              </div>

              {!data.patenteVerificada && (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <p className="text-xs font-medium text-yellow-800 mb-2">
                    Ingresa la patente correcta:
                  </p>
                  <input
                    type="text"
                    value={patenteManual}
                    onChange={(e) =>
                      setPatenteManual(e.target.value.toUpperCase())
                    }
                    placeholder="Ej: BJFP-32"
                    className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={() => {
                      setData({
                        ...data,
                        patente: patenteManual,
                        patenteVerificada: true,
                      });
                    }}
                    className="w-full mt-2 py-2 bg-yellow-600 text-white font-medium text-sm rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    Confirmar patente
                  </button>
                </div>
              )}
            </div>

            {data.patenteVerificada && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm text-green-700 font-medium">
                ✓ Patente validada: {data.patente}
              </div>
            )}
          </div>
        )}

        {/* Paso 3: Datos del Chofer */}
        {step === "chofer" && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-4">
            <h3 className="font-semibold text-neutral-900">
              Datos del Chofer/Dueño
            </h3>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={data.choferNombre || ""}
                onChange={(e) =>
                  handleChoferDataChange("choferNombre", e.target.value)
                }
                placeholder="Nombre completo"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                RUT
              </label>
              <input
                type="text"
                value={data.choferRUT || ""}
                onChange={(e) =>
                  handleChoferDataChange("choferRUT", e.target.value)
                }
                placeholder="Ej: 12.345.678-9"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Edad
              </label>
              <input
                type="number"
                value={data.choferEdad || ""}
                onChange={(e) =>
                  handleChoferDataChange("choferEdad", e.target.value)
                }
                placeholder="Edad"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Dirección de destino
              </label>
              <input
                type="text"
                value={data.direccion || ""}
                onChange={(e) =>
                  handleChoferDataChange("direccion", e.target.value)
                }
                placeholder="Ej: Av. Principal 123, Santiago"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Apreciación sobre el chofer/dueño
              </label>
              <textarea
                value={data.choferApreciacion || ""}
                onChange={(e) =>
                  handleChoferDataChange("choferApreciacion", e.target.value)
                }
                placeholder="Notas relevantes..."
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Botón Fijo Inferior */}
      {data.patenteVerificada && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 z-40">
          <button
            onClick={handleCompleteValidation}
            disabled={step !== "chofer"}
            className={cn(
              "w-full py-4 px-6 font-bold rounded-xl transition-all flex items-center justify-center gap-2",
              step === "chofer"
                ? "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/30"
                : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
            )}
          >
            <Check className="h-5 w-5" />
            VALIDACIÓN COMPLETADA
          </button>
        </div>
      )}
    </div>
  );
}
