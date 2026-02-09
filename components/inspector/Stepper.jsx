import { Check } from "lucide-react";
import { cn } from "@/lib/utils-cn";
import { CATEGORIAS } from "@/lib/inspector/inspection-items";

export default function Stepper({ currentCategoria, completadas = [] }) {
  const steps = [
    ...CATEGORIAS.map(c => ({ id: c.id, label: c.nombre })),
    { id: 'cierre', label: 'Resumen' }
  ];

  const currentIndex = steps.findIndex(s => s.id === currentCategoria);

  return (
    <div className="w-full px-2 py-4">
      <div className="flex items-center justify-between relative">
        {/* Línea de fondo */}
        <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-100 -z-0 rounded-full" />
        
        {/* Línea de progreso coloreada */}
        <div 
          className="absolute left-0 top-1/2 h-1 bg-red-600 -z-0 rounded-full transition-all duration-500"
          style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, idx) => {
          const isCompleted = completadas.includes(step.id) || idx < currentIndex;
          const isCurrent = step.id === currentCategoria;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center group">
              <div 
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-white",
                  isCompleted 
                    ? "border-red-600 bg-red-600 text-white" 
                    : isCurrent
                      ? "border-red-600 text-red-600 shadow-lg shadow-red-200 scale-110"
                      : "border-gray-200 text-gray-300"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : (
                  <span className="text-xs font-bold">{idx + 1}</span>
                )}
              </div>
              
              {/* Etiqueta (solo visible si es actual o completado para no saturar en móviles) */}
              <span className={cn(
                "absolute -bottom-6 text-[10px] font-bold whitespace-nowrap transition-all duration-300",
                isCurrent ? "text-red-700 opacity-100" : "text-gray-400 opacity-0 md:opacity-100"
              )}>
                {step.label.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
