"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ArrowRight, Rocket } from "lucide-react";
import { cn } from "@/lib/utils-cn";
import { ProgressBar } from "@/components/inspector/wizard/ProgressBar";
import { StepCapture } from "@/components/inspector/wizard/StepCapture";
import { StepVerify } from "@/components/inspector/wizard/StepVerify";
import { StepConfirm } from "@/components/inspector/wizard/StepConfirm";
import db from "@/lib/inspector/db";

const TOTAL_STEPS = 3
const STEP_TITLES = {
  1: "Captura de Evidencia",
  2: "Verificación de Datos",
  3: "Confirmar y Comenzar",
}

export default function ValidacionIdentidad() {
  const router = useRouter()
  
  // Estado del Wizard
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState("forward") // forward | back
  const [isAnimating, setIsAnimating] = useState(false)

  // Datos de negocio
  const [inspeccionId, setInspeccionId] = useState(null)
  const [fotoCapturada, setFotoCapturada] = useState(false)
  const [coincide, setCoincide] = useState(null)
  const [patenteReal, setPatenteReal] = useState("")
  const [errorPatente, setErrorPatente] = useState("")
  const [patenteSistema, setPatenteSistema] = useState("")
  const [tipoCamion, setTipoCamion] = useState("")
  const [fotoCarroCapturada, setFotoCarroCapturada] = useState(false)

  // Inicialización DB
  useEffect(() => {
    async function init() {
      const existente = await db.inspecciones.where('estado_sincronizacion').equals('en_curso').first();
      if (existente) {
        setInspeccionId(existente.id);
        const fallbackPatente = localStorage.getItem('patente_sistema') || '';
        if (existente.patente_sistema || existente.patente) {
          setPatenteSistema(existente.patente_sistema || existente.patente);
        } else {
          setPatenteSistema(fallbackPatente);
        }
        if (existente.tipo) setTipoCamion(existente.tipo);
        const foto = await db.fotos.where({ inspeccion_id: existente.id, tipo: 'patente_frontal' }).first();
        if (foto) setFotoCapturada(true);
        const fotoCarro = await db.fotos.where({ inspeccion_id: existente.id, tipo: 'patente_carro' }).first();
        if (fotoCarro) setFotoCarroCapturada(true);
        if (existente.verificacion_coincide !== undefined) setCoincide(existente.verificacion_coincide ? 'Si' : 'No');
        if (existente.patente_real) setPatenteReal(existente.patente_real);
      } else {
        const selectedIdRaw = localStorage.getItem('inspeccion_actual_id');
        const selectedId = selectedIdRaw ? Number(selectedIdRaw) : null;
        const fallbackPatente = localStorage.getItem('patente_sistema') || '';
        if (!selectedId || !fallbackPatente) {
          router.replace('/inspector');
          return;
        }

        const base = await db.inspecciones.get(selectedId);
        if (!base) {
          router.replace('/inspector');
          return;
        }

        await db.inspecciones.update(selectedId, {
          estado_sincronizacion: 'en_curso',
          timestamp_inicio: base.timestamp_inicio || new Date().toISOString()
        });

        setInspeccionId(selectedId);
        setPatenteSistema(base.patente_sistema || base.patente || fallbackPatente);
        if (base.tipo) setTipoCamion(base.tipo);
      }
    }
    init();
  }, []);

  // Animación de transición
  const animateTransition = useCallback((newStep, dir) => {
    setDirection(dir)
    setIsAnimating(true)
    setTimeout(() => {
      setStep(newStep)
      setTimeout(() => setIsAnimating(false), 50)
    }, 200)
  }, [])

  const handleNext = async () => {
    const requiereCarro = /carro|remolque|acoplado|semi|refriger/i.test(tipoCamion || '');

    if (step === 1) {
      if (!fotoCapturada) return;
      if (requiereCarro && !fotoCarroCapturada) return;
    }
    if (step === 2) {
      if (coincide === null) return
      if (coincide === "No" && !/^[A-Z0-9]{6,7}$/.test(patenteReal)) {
        setErrorPatente("Ingrese patente válida (6-7 caracteres)")
        return
      }
      
      // Guardar decisión al avanzar del paso 2
      if (inspeccionId) {
        await db.inspecciones.update(inspeccionId, { 
            verificacion_coincide: coincide === 'Si',
            flag_discrepancia: coincide === 'No',
            patente_real: coincide === 'Si' ? null : patenteReal
        });
      }
      // marcar siempre validación local
      localStorage.setItem('patente_validada', 'true');
    }
    
    if (step < TOTAL_STEPS) {
      animateTransition(step + 1, "forward")
    } else {
      // Navegar al final
      router.push('/inspector/inspeccion/criticos')
    }
  }

  const handleBack = () => {
    if (step > 1) {
      animateTransition(step - 1, "back")
    }
  }

  // Handlers UI
  const handleCoincideSelection = (valor) => {
    setCoincide(valor)
    if (valor === "Si") {
      setPatenteReal("")
      setErrorPatente("")
    }
  }

  const handlePatenteChange = (val) => {
    setPatenteReal(val)
    setErrorPatente("")
  }

  const isNextDisabled =
    (step === 1 && !fotoCapturada) ||
    (step === 1 && /carro|remolque|acoplado|semi|refriger/i.test(tipoCamion || '') && !fotoCarroCapturada) ||
    (step === 2 && coincide === null) ||
    (step === 2 && coincide === "No" && !!errorPatente)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-red-950 to-black p-4 relative overflow-hidden font-sans">
      {/* Background Pattern (Rojo Petran) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.04),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(220,38,38,0.18),transparent_50%)]" />
      <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(135deg,rgba(127,29,29,1)_0%,rgba(153,27,27,1)_30%,rgba(127,29,29,1)_70%,rgba(100,20,20,1)_100%)]" />

      {/* Floating Card */}
      <div className="relative w-full max-w-md z-10">
        {/* Card Shadow */}
        <div className="absolute -inset-2 bg-black/20 rounded-[32px] blur-2xl" />

        <div className="relative bg-card rounded-3xl shadow-2xl overflow-hidden min-h-[580px] flex flex-col">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-5">
              <button
                type="button"
                onClick={handleBack}
                disabled={step === 1}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                  step === 1
                    ? "opacity-0 pointer-events-none"
                    : "text-primary hover:bg-primary/5 active:scale-95"
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                Volver
              </button>

              <div className="bg-muted px-3 py-1.5 rounded-full">
                <span className="text-xs font-bold text-muted-foreground tabular-nums">
                  {step} / {TOTAL_STEPS}
                </span>
              </div>
            </div>

            <h1
              key={step}
              className={cn(
                "text-2xl font-bold text-foreground mb-4 transition-all duration-300",
                isAnimating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
              )}
            >
              {STEP_TITLES[step]}
            </h1>

            <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />
          </div>

          {/* Content Area */}
          <div className="px-6 py-2 flex-1 flex flex-col overflow-y-auto">
            <div
              className={cn(
                "flex-1 flex flex-col transition-all duration-300 ease-out",
                isAnimating && direction === "forward" && "opacity-0 -translate-x-4",
                isAnimating && direction === "back" && "opacity-0 translate-x-4",
                !isAnimating && "opacity-100 translate-x-0"
              )}
            >
              {step === 1 && (
                <>
                  <StepCapture
                    patenteSistema={patenteSistema}
                    fotoCapturada={fotoCapturada}
                    onPhotoCaptured={() => setFotoCapturada(true)}
                    inspeccionId={inspeccionId}
                    tituloBoton="📷 Foto patente camión"
                    tipoFoto="patente_frontal"
                  />
                  {/carro|remolque|acoplado|semi|refriger/i.test(tipoCamion || '') && (
                    <div className="mt-4">
                      <StepCapture
                        patenteSistema={'CARRO / REMOLQUE'}
                        fotoCapturada={fotoCarroCapturada}
                        onPhotoCaptured={() => setFotoCarroCapturada(true)}
                        inspeccionId={inspeccionId}
                        tituloBoton="📷 Foto patente carro/remolque"
                        tipoFoto="patente_carro"
                      />
                    </div>
                  )}
                </>
              )}

              {step === 2 && (
                <StepVerify
                  patenteSistema={patenteSistema}
                  coincide={coincide}
                  patenteReal={patenteReal}
                  errorPatente={errorPatente}
                  onCoincideSelection={handleCoincideSelection}
                  onPatenteChange={handlePatenteChange}
                />
              )}

              {step === 3 && (
                <StepConfirm
                  patenteSistema={patenteSistema}
                  patenteReal={patenteReal}
                  coincide={coincide}
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-3 bg-card border-t border-border">
            <button
              type="button"
              onClick={handleNext}
              disabled={isNextDisabled}
              className={cn(
                "w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-300",
                isNextDisabled
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 active:scale-[0.98]"
              )}
            >
              {step === TOTAL_STEPS ? (
                <>
                  <Rocket className="w-5 h-5" />
                  Comenzar Inspección
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
