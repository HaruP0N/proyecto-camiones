"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Fingerprint, Truck, Lock, User, AlertCircle } from "lucide-react";
import { Input, Button, Card, CardBody } from "@heroui/react";
import { loginStaff } from "@/lib/inspector/api";
import { iniciarSyncBackground } from "@/lib/inspector/sync";

export default function Login() {
  const router = useRouter();
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (window.PublicKeyCredential) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(available => setHasBiometrics(available))
        .catch(() => setHasBiometrics(false))
    }
  }, []);

  // 2. MODIFICAR HANDLELOGIN PARA CONECTAR AL BACKEND
  const handleLogin = async () => {
    if (!email || !password) {
      setError("Por favor ingresa usuario y contraseña");
      return;
    }

    setIsLoading(true);
    setError("");
    
    try {
      const data = await loginStaff(email, password);

      localStorage.setItem("petran_session", "active");
      localStorage.setItem("petran_user", JSON.stringify(data.user));

      iniciarSyncBackground();

      const rol = data?.user?.rol;
      if (rol === "admin") {
        router.replace("/admin");
        return;
      }

      router.replace("/inspector");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Credenciales incorrectas o error de servidor");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return ( 
    // ... (El resto de tu JSX se mantiene igual, con tu diseño visual intacto)
    <div className='min-h-screen flex items-center justify-center p-5 bg-gradient-to-br from-gray-900 via-red-950 to-black relative overflow-hidden font-sans'>
      {/* ... (código visual del login) ... */}
         {/* Asegúrate de mantener todo el JSX visual exactamente como lo tenías */}
         <div className='absolute inset-0 bg-[radial-gradient(circle_at_15%_85%,rgba(255,255,255,0.05),transparent_45%)]' />
         <div className='absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(220,38,38,0.12),transparent_45%)]' />

         <motion.div
           initial={{ opacity: 0, y: 14 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.45 }}
           className='w-full max-w-sm relative z-10'
         >
           {/* Logo */}
           <div className='text-center mb-8'>
             <div className='relative inline-block'>
               <div className='absolute -inset-4 bg-white/10 rounded-full blur-xl' />
               <div className='w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/15 shadow-2xl relative'>
                 <Truck className='w-11 h-11 text-white' />
               </div>
             </div>
             <h1 className='text-3xl font-black text-white mt-5 tracking-tight'>
               PETRAN<span className='text-red-300'> INSPECCIONES</span>
             </h1>
             <p className='text-gray-300 text-xs font-semibold tracking-[0.25em] uppercase mt-1'>
               Portal de Inspectores
             </p>
           </div>
   
           {/* Card de Acceso */}
           <Card className='bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-[2rem]'>
             <CardBody className='p-7 gap-5'>
               
               {/* Mensaje de Error */}
               {error && (
                 <motion.div 
                   initial={{ opacity: 0, height: 0 }}
                   animate={{ opacity: 1, height: 'auto' }}
                   className="bg-red-500/20 border border-red-300/40 rounded-xl p-3 flex items-center gap-2"
                 >
                   <AlertCircle className="w-4 h-4 text-red-200" />
                   <p className="text-xs font-medium text-white">{error}</p>
                 </motion.div>
               )}
   
               <div className='space-y-4'>
                 <Input
                   placeholder="Usuario / Correo"
                   value={email}
                   onValueChange={setEmail}
                   startContent={
                     <div className="w-6 h-6 flex items-center justify-center">
                       <User className="w-5 h-5 text-gray-500" />
                     </div>
                   }
                   classNames={{
                     inputWrapper: "h-14 rounded-2xl bg-white/95 transition-all focus-within:ring-2 focus-within:ring-red-400",
                     innerWrapper: "flex items-center gap-3",
                     input: "text-base font-medium text-gray-800"
                   }}
                 />
   
                 <Input
                   type="password"
                   placeholder="Contraseña"
                   value={password}
                   onValueChange={setPassword}
                   onKeyDown={handleKeyDown}
                   startContent={
                     <div className="w-6 h-6 flex items-center justify-center">
                       <Lock className="w-5 h-5 text-gray-500" />
                     </div>
                   }
                   classNames={{
                     inputWrapper: "h-14 rounded-2xl bg-white/95 transition-all focus-within:ring-2 focus-within:ring-red-400",
                     innerWrapper: "flex items-center gap-3",
                     input: "text-base font-medium text-gray-800"
                   }}
                 />
               </div>
   
               {/* Botón Principal */}
               <Button
                 size='lg'
                 className='w-full h-14 font-black text-lg bg-[#7f1d1d] text-white rounded-2xl shadow-xl shadow-red-900/50 hover:bg-red-900 active:scale-[0.99] transition-all'
                 onPress={handleLogin}
                 isLoading={isLoading}
               >
                 {isLoading ? 'Autenticando...' : 'Iniciar Sesión'}
               </Button>
   
               {/* Opción Biométrica */}
               {hasBiometrics && (
                 <>
                   <div className='relative py-1'>
                     <div className='absolute inset-0 flex items-center'>
                       <div className='w-full border-t border-white/20'></div>
                     </div>
                     <div className='relative flex justify-center text-xs uppercase'>
                       <span className='bg-transparent px-2 text-white/60 font-bold tracking-widest'>
                         O accede con
                       </span>
                     </div>
                   </div>
   
                   <Button
                     size='lg'
                     className='w-full h-14 font-bold bg-white/10 text-white border border-white/25 hover:bg-white/15 rounded-2xl backdrop-blur-sm'
                     onPress={() => alert('Integración biométrica en desarrollo')}
                     startContent={<Fingerprint className='w-6 h-6 text-red-300' />}
                   >
                     Face ID
                   </Button>
                 </>
               )}
             </CardBody>
           </Card>
         </motion.div>
    </div>
  )
}
