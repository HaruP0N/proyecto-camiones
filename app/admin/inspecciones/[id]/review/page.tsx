"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function InspeccionReviewPage() {
  const router = useRouter();

  return (
    <div>
      {/* Botón Volver al inicio */}
      <Button variant="outline" onClick={() => router.push("/admin")}>
        Volver al inicio
      </Button>
      {/* ...existing code for review details... */}
    </div>
  );
}
