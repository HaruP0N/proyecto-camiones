import { Check, X, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils-cn"

export function StepVerify({
  patenteSistema,
  coincide,
  patenteReal,
  errorPatente,
  onCoincideSelection,
  onPatenteChange,
}) {
  return (
    <div className="flex flex-col gap-5 flex-1 animate-in fade-in slide-in-from-right-8 duration-500">
      <p className="text-muted-foreground text-sm leading-relaxed">
        {"¿La patente física del vehículo coincide con "}
        <span className="font-bold text-foreground font-mono tracking-wider">{patenteSistema}</span>
        {"?"}
      </p>

      <div className="flex flex-col gap-3">
        {/* Opción SI */}
        <button
          type="button"
          onClick={() => onCoincideSelection("Si")}
          className={cn(
            "w-full rounded-2xl p-5 border-2 transition-all duration-300 text-left",
            coincide === "Si"
              ? "border-accent bg-accent/5 shadow-lg shadow-accent/10"
              : "border-border bg-card hover:border-accent/40 hover:shadow-md"
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                coincide === "Si"
                  ? "bg-accent text-accent-foreground shadow-md shadow-accent/30"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Check className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-foreground text-base">Sí, coincide</p>
              <p className="text-xs text-muted-foreground mt-0.5">La patente es correcta</p>
            </div>
            {coincide === "Si" && (
              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center animate-in zoom-in duration-200">
                <Check className="w-3.5 h-3.5 text-accent-foreground" strokeWidth={3} />
              </div>
            )}
          </div>
        </button>

        {/* Opción NO */}
        <button
          type="button"
          onClick={() => onCoincideSelection("No")}
          className={cn(
            "w-full rounded-2xl p-5 border-2 transition-all duration-300 text-left",
            coincide === "No"
              ? "border-destructive bg-destructive/5 shadow-lg shadow-destructive/10"
              : "border-border bg-card hover:border-destructive/40 hover:shadow-md"
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                coincide === "No"
                  ? "bg-destructive text-destructive-foreground shadow-md shadow-destructive/30"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <X className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-foreground text-base">No coincide</p>
              <p className="text-xs text-muted-foreground mt-0.5">Reportar discrepancia</p>
            </div>
            {coincide === "No" && (
              <div className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center animate-in zoom-in duration-200">
                <Check className="w-3.5 h-3.5 text-destructive-foreground" strokeWidth={3} />
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Input de Patente Real */}
      {coincide === "No" && (
        <div className="animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-destructive/5 rounded-2xl p-5 border border-destructive/20">
            <label className="text-sm font-semibold text-destructive flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4" />
              Ingrese la patente observada
            </label>
            <input
              autoFocus
              placeholder="AB1234"
              value={patenteReal}
              onChange={(e) => onPatenteChange(e.target.value.toUpperCase())}
              maxLength={7}
              className={cn(
                "w-full h-14 bg-card border-2 rounded-xl text-center text-3xl font-mono font-bold uppercase tracking-[0.2em] transition-all duration-200 outline-none text-foreground placeholder:text-muted-foreground/40",
                errorPatente
                  ? "border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20"
                  : "border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
              )}
            />
            {errorPatente && (
              <p className="text-destructive text-xs mt-2 font-medium">{errorPatente}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
