import { Camera, ShieldCheck, MapPin, Truck, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils-cn"

export function StepConfirm({ patenteSistema, patenteReal, coincide }) {
  const patenteDisplay = coincide === "Si" ? patenteSistema : patenteReal

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center animate-in zoom-in-95 fade-in duration-500">
      {/* Icono Hero */}
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-xl animate-pulse" />
        <div className="relative w-20 h-20 bg-primary rounded-3xl flex items-center justify-center shadow-xl shadow-primary/30">
          <Truck className="w-10 h-10 text-primary-foreground" />
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-foreground mb-2 text-balance">Todo Listo</h3>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
          {"Se iniciará la inspección para el vehículo con patente"}
        </p>
        <p className="text-3xl font-mono font-bold text-primary tracking-[0.2em] mt-2">
          {patenteDisplay}
        </p>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="w-full flex flex-col gap-2.5">
        <SummaryRow
          icon={<Camera className="w-5 h-5" />}
          label="Fotografía"
          status="Capturada"
          variant="success"
        />
        <SummaryRow
          icon={<ShieldCheck className="w-5 h-5" />}
          label="Verificación"
          status={coincide === "Si" ? "Coincide" : "Discrepancia"}
          variant={coincide === "Si" ? "info" : "warning"}
        />
        <SummaryRow
          icon={<MapPin className="w-5 h-5" />}
          label="Ubicación GPS"
          status="Activo"
          variant="success"
        />
      </div>
    </div>
  )
}

function SummaryRow({ icon, label, status, variant }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl px-4 py-3.5 border transition-all hover:scale-[1.02]",
        variant === "success" && "bg-accent/5 border-accent/20",
        variant === "info" && "bg-primary/5 border-primary/20",
        variant === "warning" && "bg-chart-4/10 border-chart-4/30"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center",
            variant === "success" && "bg-accent text-accent-foreground",
            variant === "info" && "bg-primary text-primary-foreground",
            variant === "warning" && "bg-chart-4 text-foreground"
          )}
        >
          {icon}
        </div>
        <span className="font-medium text-sm text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {variant === "warning" ? (
          <AlertTriangle className="w-3.5 h-3.5 text-chart-4" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5 text-accent" />
        )}
        <span
          className={cn(
            "text-sm font-semibold",
            variant === "success" && "text-accent",
            variant === "info" && "text-primary",
            variant === "warning" && "text-chart-4"
          )}
        >
          {status}
        </span>
      </div>
    </div>
  )
}
