import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InspectorLoginPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Login inspector</CardTitle>
        </CardHeader>
        <CardContent>
           <p className="text-center text-muted-foreground mb-4">Formulario de acceso aquí</p>
           <Button className="w-full">Ingresar</Button>
        </CardContent>
      </Card>
    </div>
  );
}