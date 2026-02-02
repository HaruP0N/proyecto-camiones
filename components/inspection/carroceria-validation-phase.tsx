"use client";

import { useState } from "react";
import { Camera, Check, X } from "lucide-react";
import { cn } from "@/lib/utils-cn";

const TIPOS_CARROCERIA = [
  { id: "CAMION_CON_CARRO", nombre: "Camión con carro" },
  { id: "CARRO_REEFER", nombre: "Carro reefer" },
  { id: "CAMARA_DE_FRIO", nombre: "Cámara de frío" },
  { id: "CAMION_PAQUETERO", nombre: "Camión paquetero" },
];

export interface CarroceriaValidationData {
  foto?: string;
  tipoCarroceria: string;
  tipoVerificado: boolean;
}

interface CarroceriaValidationPhaseProps {
  tipoCarroceriaBD: string;
  onComplete: (data: CarroceriaValidationData) => void;
  initialData?: CarroceriaValidationData;
}

export function CarroceriaValidationPhase({
  tipoCarroceriaBD,
  onComplete,
  initialData,
}: CarroceriaValidationPhaseProps) {
  const [step, setStep] = useState<"foto" | "tipo">("foto");
  const [data, setData] = useState<CarroceriaValidationData>(
    initialData || {
      tipoCarroceria: tipoCarroceriaBD,
      tipoVerificado: false,
    }
  );
  const [fotoPreview, setFotoPreview] = useState<string>(
    initialData?.foto || ""
  );

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
      setStep("tipo");
    };
    reader.readAsDataURL(file);
  };

  const handleTipoVerificado = (correcta: boolean) => {
    if (correcta) {
      setData({
        ...data,
        tipoCarroceria: tipoCarroceriaBD,
        tipoVerificado: true,
      });
    } else {
      setData({
        ...data,
        tipoVerificado: false,
      });
    }
  };

  const handleTipoChange = (nuevoTipo: string) => {
    setData({
      ...data,
      tipoCarroceria: nuevoTipo,
      tipoVerificado: true,
    });
  };

  const handleCompleteValidation = () => {
    if (!data.tipoVerificado) {
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
            Validación de Carrocería
          </h1>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Paso 1: Foto de Carrocería */}
        {(step === "foto" || fotoPreview) && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-4">
            <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <Camera className="h-5 w-5 text-red-600" />
              Foto de la Carrocería
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
                  alt="Foto carrocería"
                  className="w-full h-64 object-cover rounded-xl"
                />
                <button
                  onClick={() => {
                    setFotoPreview("");
                    setData({ ...data, foto: undefined });
                    setStep("foto");
                  }}
                  className="w-full py-2 text-sm text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors"
                >
                  Retomar foto
                </button>
              </div>
            )}
          </div>
        )}

        {/* Paso 2: Validar Tipo de Carrocería */}
        {step === "tipo" && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-4">
            <h3 className="font-semibold text-neutral-900">
              Verificar Tipo de Carrocería
            </h3>

            <p className="text-sm text-neutral-600">
              Tipo en sistema:{" "}
              <strong>
                {
                  TIPOS_CARROCERIA.find((t) => t.id === tipoCarroceriaBD)
                    ?.nombre
                }
              </strong>
            </p>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                ¿Es correcto?
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleTipoVerificado(true)}
                  className="flex-1 py-3 bg-green-100 text-green-700 font-medium rounded-lg hover:bg-green-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="h-5 w-5" />
                  Sí, es correcto
                </button>
                <button
                  onClick={() => handleTipoVerificado(false)}
                  className="flex-1 py-3 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="h-5 w-5" />
                  No, es otro
                </button>
              </div>
            </div>

            {!data.tipoVerificado && (
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 space-y-2">
                <p className="text-xs font-medium text-yellow-800">
                  Selecciona el tipo correcto:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS_CARROCERIA.map((tipo) => (
                    <button
                      key={tipo.id}
                      onClick={() => handleTipoChange(tipo.id)}
                      className="p-2 text-sm font-medium bg-white border border-yellow-300 rounded-lg hover:bg-yellow-100 transition-colors"
                    >
                      {tipo.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {data.tipoVerificado && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm text-green-700 font-medium">
                ✓ Tipo validado:{" "}
                {
                  TIPOS_CARROCERIA.find((t) => t.id === data.tipoCarroceria)
                    ?.nombre
                }
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botón Fijo Inferior */}
      {data.tipoVerificado && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 z-40">
          <button
            onClick={handleCompleteValidation}
            disabled={step !== "tipo"}
            className={cn(
              "w-full py-4 px-6 font-bold rounded-xl transition-all flex items-center justify-center gap-2",
              step === "tipo"
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
