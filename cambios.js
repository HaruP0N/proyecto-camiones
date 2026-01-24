const fs = require('fs');
const path = require('path');

// --- CONFIGURACIÓN ---
const rootDir = path.join(__dirname, 'app');
const authDir = path.join(rootDir, '(auth)', 'login');
const dashboardDir = path.join(rootDir, '(dashboard)');

// --- UTILIDADES ---
function move(src, dest) {
  if (fs.existsSync(src)) {
    // Asegurar que el directorio padre del destino exista
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Si el destino ya existe (ej: carpeta vacía), intentamos mover el contenido
    if (fs.existsSync(dest) && fs.lstatSync(dest).isDirectory()) {
       console.log(`⚠️  El destino ya existe: ${dest}. Moviendo contenido interno...`);
       // (Simplificación: en este caso asumimos que renombramos o sobrescribimos si es archivo)
    }
    
    try {
        fs.renameSync(src, dest);
        console.log(`✅ Movido: ${path.relative(__dirname, src)}  ➡️  ${path.relative(__dirname, dest)}`);
    } catch (e) {
        console.error(`❌ Error moviendo ${path.basename(src)}: ${e.message}`);
    }
  } else {
    console.log(`💨 Saltando (no existe): ${path.relative(__dirname, src)}`);
  }
}

function createLoginPlaceholder(userType) {
    const filePath = path.join(authDir, userType, 'page.tsx');
    if (!fs.existsSync(filePath)) {
        const content = `
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ${userType.charAt(0).toUpperCase() + userType.slice(1)}LoginPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Login ${userType}</CardTitle>
        </CardHeader>
        <CardContent>
           <p className="text-center text-muted-foreground mb-4">Formulario de acceso aquí</p>
           <Button className="w-full">Ingresar</Button>
        </CardContent>
      </Card>
    </div>
  );
}
`;
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content.trim());
        console.log(`✨ Login placeholder creado para: ${userType}`);
    }
}

// --- EJECUCIÓN ---

console.log('👷 Iniciando reparación de estructura de carpetas...');

// 1. Crear carpeta base (dashboard)
if (!fs.existsSync(dashboardDir)) fs.mkdirSync(dashboardDir, { recursive: true });

// === ADMIN ===
console.log('\n--- Reparando ADMIN ---');
// Mover carpetas de gestión a (dashboard)/admin
const adminDashPath = path.join(dashboardDir, 'admin');
move(path.join(authDir, 'admin', 'camiones'), path.join(adminDashPath, 'camiones'));
move(path.join(authDir, 'admin', 'empresas'), path.join(adminDashPath, 'empresas'));
move(path.join(authDir, 'admin', 'inspectores'), path.join(adminDashPath, 'inspectores'));
move(path.join(authDir, 'admin', '_components'), path.join(adminDashPath, '_components'));

// Mover el Dashboard (page.tsx) a su lugar
const adminDashPage = path.join(authDir, 'admin', 'page.tsx');
if (fs.existsSync(adminDashPage)) {
    // Verificamos si es el dashboard (tiene AdminShell) o el login
    const content = fs.readFileSync(adminDashPage, 'utf-8');
    if (content.includes('AdminShell') || content.includes('sidebar')) {
        move(adminDashPage, path.join(adminDashPath, 'page.tsx'));
    }
}

// Recuperar el Login real (que estaba anidado en admin/login/page.tsx)
const nestedLogin = path.join(authDir, 'admin', 'login', 'page.tsx');
const correctLogin = path.join(authDir, 'admin', 'page.tsx');

if (fs.existsSync(nestedLogin)) {
    // Si ya existe un archivo en el destino (ej. el dashboard no se movió), lo renombramos por seguridad
    if (fs.existsSync(correctLogin)) {
        const backup = path.join(authDir, 'admin', 'page_backup.tsx');
        fs.renameSync(correctLogin, backup);
        console.log(`⚠️ Archivo existente en login renombrado a page_backup.tsx`);
    }
    move(nestedLogin, correctLogin);
    // Borrar carpeta vacía
    try { fs.rmdirSync(path.join(authDir, 'admin', 'login')); } catch(e) {}
}

// === CLIENTE ===
console.log('\n--- Reparando CLIENTE ---');
const clientDashPath = path.join(dashboardDir, 'cliente');
move(path.join(authDir, 'cliente', 'flota'), path.join(clientDashPath, 'flota'));
move(path.join(authDir, 'cliente', 'fotos'), path.join(clientDashPath, 'fotos'));
move(path.join(authDir, 'cliente', 'ingresar'), path.join(clientDashPath, 'ingresar'));
move(path.join(authDir, 'cliente', 'nuevo'), path.join(clientDashPath, 'nuevo'));
// El page.tsx que está ahí es casi seguro el Dashboard (menú)
move(path.join(authDir, 'cliente', 'page.tsx'), path.join(clientDashPath, 'page.tsx'));

// Crear login si falta
createLoginPlaceholder('cliente');

// === INSPECTOR ===
console.log('\n--- Reparando INSPECTOR ---');
const inspectorDashPath = path.join(dashboardDir, 'inspector');
// Mover todo lo que haya en inspector a dashboard, asumiendo que era el panel
move(path.join(authDir, 'inspector', 'page.tsx'), path.join(inspectorDashPath, 'page.tsx'));

// Crear login si falta
createLoginPlaceholder('inspector');

console.log('\n✅ Reparación completada.');
console.log('📂 Verifica tus carpetas (dashboard) y (auth).');