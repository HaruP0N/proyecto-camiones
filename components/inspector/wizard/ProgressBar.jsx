import { cn } from "@/lib/utils-cn"

export function ProgressBar({ currentStep, totalSteps }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNum) => (
        <div key={stepNum} className="flex-1 flex items-center gap-2">
          <div
            className={cn(
              "h-1.5 w-full rounded-full transition-all duration-500 ease-out",
              stepNum <= currentStep
                ? "bg-primary"
                : "bg-foreground/10"
            )}
          />
        </div>
      ))}
    </div>
  )
}
