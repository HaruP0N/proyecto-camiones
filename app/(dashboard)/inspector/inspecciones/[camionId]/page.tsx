"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
// import { useInspectionDraft } from "@/hooks/use-inspection-draft"; // ← COMENTADO TEMPORALMENTE
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast"; 
import { 
  ArrowLeft, 
  Truck, 
  Building2, 
  MapPin, 
  FileText, 
  Camera, 
  Info,
  CheckCircle2,
  Phone
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface CamionDetalle {
  id: number;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  tipo: string;
  carroceria: string | null;
  empresa: {
    nombre: string;
    rut: string;
    direccion: string;
    contacto: string;
  };
}

export default function PreInspeccionPage() {
  console.log("🔴 COMPONENTE MONTADO - PreInspeccionPage");
  
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const camionId = params.camionId as string;

  const [loading, setLoading] = useState(true);
  const [camion, setCamion] = useState<CamionDetalle | null>(null);

  // 🔍 COMENTADO PARA PROBAR SI EL ERROR ESTÁ AQUÍ
  // const { draft, updateDraft } = useInspectionDraft(camionId);

  useEffect(() => {
    async function loadCamion() {
      try {
        console.log("📡 Fetching camion con ID:", camionId);
        
        const res = await fetch(`/api/inspector/inspecciones/camion/${camionId}`);
        if (!res.ok) throw new Error("Error al cargar datos");
        const json = await res.json();
        
        console.log("📦 Datos recibidos:", json.data);
        console.log("🏢 Empresa recibida:", json.data?.empresa);
        console.log("🏢 Tipo de empresa:", typeof json.data?.empresa);
        
        setCamion(json.data);
      } catch (error) {
        console.error("❌ Error en fetch:", error);
        toast({
          title: "Error",
          description: "No pudimos cargar la información del vehículo.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    loadCamion();
  }, [camionId, toast]);

  const handleStartInspection = () => {
    if (!camion) return;
    
    console.log("🚀 Iniciando inspección");
    console.log("📋 Camion completo:", camion);
    console.log("🏢 Empresa:", camion.empresa);
    
    // updateDraft({ ...draft }); // ← COMENTADO
    router.push(`/inspector/inspeccion/${camionId}/activa`);
  };

  if (loading) {
    console.log("⏳ Estado: LOADING");
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Spinner className="h-10 w-10 text-slate-900" />
        <p className="text-slate-500 animate-pulse">Obteniendo ficha técnica...</p>
      </div>
    );
  }

  if (!camion) {
    console.log("❌ Estado: SIN CAMION");
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-white p-6 rounded-full shadow-sm mb-4">
          <Info className="h-12 w-12 text-slate-300" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Vehículo no encontrado</h2>
        <p className="text-slate-500 mt-2 mb-6 max-w-xs mx-auto">
          No pudimos encontrar los datos de este camión.
        </p>
        <Button onClick={() => router.back()} variant="outline">
          Volver al Inicio
        </Button>
      </div>
    );
  }

  console.log("✅ RENDERIZANDO CON CAMION:", camion);
  console.log("✅ Empresa antes del render:", camion.empresa);
  console.log("✅ Empresa.nombre:", camion.empresa.nombre);
  console.log("✅ Empresa.rut:", camion.empresa.rut);

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.back()} 
            className="hover:bg-slate-100 rounded-full"
          >
            <ArrowLeft className="h-5 w-5 text-slate-700" />
          </Button>
          <div>
            <h1 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Ficha Técnica</h1>
            <p className="text-lg font-bold text-slate-900 leading-none">{camion.patente}</p>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="bg-slate-900 p-6 text-white relative overflow-hidden">
            <Truck className="absolute -right-6 -bottom-6 h-40 w-40 text-white/5 rotate-[-10deg]" />
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm">
                  {camion.tipo || "Vehículo"}
                </Badge>
                <div className="text-right">
                  <p className="text-xs text-slate-400 font-medium uppercase">Modelo</p>
                  <p className="font-semibold text-lg">{camion.anio}</p>
                </div>
              </div>
              
              <h2 className="text-3xl font-bold mb-1">{camion.marca}</h2>
              <p className="text-xl text-slate-300 font-light">{camion.modelo}</p>
            </div>
          </div>
          
          <div className="p-4 grid grid-cols-2 gap-4 bg-white">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                <FileText className="h-3 w-3" /> Carrocería
              </p>
              <p className="font-semibold text-slate-900">{camion.carroceria || "Estándar"}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                <Info className="h-3 w-3" /> ID Interno
              </p>
              <p className="font-semibold text-slate-900">#{camion.id}</p>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide ml-1">
            Datos del Cliente
          </h3>
          <Card className="p-0 overflow-hidden border-slate-200 shadow-sm">
            <div className="p-4 flex items-start gap-4">
              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-blue-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">{camion.empresa.nombre}</h4>
                <p className="text-sm text-slate-500 font-mono mt-0.5">{camion.empresa.rut}</p>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-1 divide-y">
              <div className="p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                <MapPin className="h-5 w-5 text-slate-400" />
                <div className="text-sm">
                  <p className="text-slate-500 text-xs font-medium">Dirección Comercial</p>
                  <p className="text-slate-900 font-medium">{camion.empresa.direccion}</p>
                </div>
              </div>
              <div className="p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                <Phone className="h-5 w-5 text-slate-400" />
                <div className="text-sm">
                  <p className="text-slate-500 text-xs font-medium">Contacto</p>
                  <p className="text-slate-900 font-medium">{camion.empresa.contacto}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
          <div>
            <h4 className="font-bold text-green-800 text-sm">Listo para inspeccionar</h4>
            <p className="text-xs text-green-700 mt-1 leading-relaxed">
              Al confirmar, iniciarás el proceso de revisión técnica.
            </p>
          </div>
        </div>

      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-50 safe-area-bottom">
        <div className="max-w-xl mx-auto">
          <Button 
            onClick={handleStartInspection}
            className="w-full h-14 text-lg font-bold bg-slate-900 hover:bg-blue-600 text-white shadow-lg shadow-slate-900/20 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Camera className="h-6 w-6" />
            COMENZAR INSPECCIÓN
          </Button>
        </div>
      </div>
    </div>
  );
}
