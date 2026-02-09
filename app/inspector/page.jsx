"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Calendar,
  Phone,
  MapPin,
  ChevronRight,
  Truck,
  BarChart3,
  CheckCircle2,
  LogOut,
  Settings,
  HelpCircle,
  Camera,
  RefreshCw,
  Bell
} from "lucide-react";
import {
  Card, CardBody, Button, Avatar, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip, Input
} from "@heroui/react";
import db from "@/lib/inspector/db";
import { descargarAsignaciones, procesarCola } from "@/lib/inspector/sync";

export default function Dashboard() {
  const router = useRouter();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [selectedTask, setSelectedTask] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('https://i.pravatar.cc/150?u=petran');
  const [profileModal, setProfileModal] = useState(false);
  const [user, setUser] = useState({});
  const [profileForm, setProfileForm] = useState({ nombre: "", email: "", password: "" });
  const [isSyncing, setIsSyncing] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const fileInputRef = useRef(null);
  const inspeccionActiva = useLiveQuery(
    () => db.inspecciones.where('estado_sincronizacion').equals('en_curso').first(),
    []
  );

  // ✅ DATOS EN VIVO - Conexión a Dexie con useLiveQuery
  const tareasReales = useLiveQuery(
    () => db.inspecciones
      .where('estado_sincronizacion')
      .anyOf('programada') // solo asignaciones activas
      .toArray(),
    [] // Dependencias vacías = siempre actualizado
  );

  const TASKS = (tareasReales || []).filter(t => (t.patente_sistema || t.patente));
  const listadoDeshabilitado = !!inspeccionActiva;
  const patenteActiva = inspeccionActiva?.patente_sistema || inspeccionActiva?.patente || 'Sin patente';

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = JSON.parse(localStorage.getItem("petran_user") || "{}");
    setUser(stored);
    setProfileForm({
      nombre: stored.nombre || "",
      email: stored.email || "",
      password: "",
    });
  }, []);

  // Limpieza local de inspecciones inválidas (sin patente y sin camion_id)
  useEffect(() => {
    db.inspecciones
      .filter((i) => !i.patente_sistema && !i.patente && !i.camion_id)
      .primaryKeys()
      .then((keys) => {
        if (keys.length > 0) db.inspecciones.bulkDelete(keys);
      })
      .catch(() => {});
  }, []);

  // ✅ Lógica de inactividad (10 min)
  useEffect(() => {
    const INACTIVITY_TIME = 10 * 60 * 1000;
    let timeoutId;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => handleLogout(), INACTIVITY_TIME);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/staff/logout", { method: "POST" });
    } catch {
      // noop: logout local aunque falle la red
    }
    localStorage.removeItem('petran_session');
    localStorage.removeItem('petran_user');
    localStorage.removeItem('inspeccion_actual_id');
    localStorage.removeItem('patente_validada');
    localStorage.removeItem('patente_sistema');
    localStorage.removeItem('tipo_camion');
    localStorage.removeItem('carroceria_camion');
    router.replace('/inspector/login');
  };

  const handleProfileSave = () => {
    const updated = { ...user, ...profileForm };
    localStorage.setItem("petran_user", JSON.stringify(updated));
    setUser(updated);
    setProfileModal(false);
  };

  // ✅ BOTÓN DE REFRESCO MANUAL
  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
      await procesarCola();
      await descargarAsignaciones();
      console.log('✅ Sincronización manual completada');
      await loadNotifs();
    } catch (error) {
      console.error('❌ Error en sincronización:', error);
    } finally {
      setTimeout(() => setIsSyncing(false), 1000);
    }
  };

  const loadNotifs = async () => {
    try {
      setNotifLoading(true);
      const res = await fetch("/api/inspector/notificaciones?limit=20");
      const data = await res.json();
      if (data?.ok) {
        setNotifs(data.data || []);
        setNotifUnread(data.unread || 0);
      }
    } catch {
      // silent
    } finally {
      setNotifLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch("/api/inspector/notificaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true })
      });
      setNotifs((prev) => prev.map((n) => ({ ...n, leida: true })));
      setNotifUnread(0);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    onOpen();
  };

  const handleStartInspection = async () => {
    if (selectedTask) {
      if (!selectedTask.patente && !selectedTask.patente_sistema) {
        alert("No hay patente válida para iniciar la inspección.");
        return;
      }
      // ✅ Guardar ID de inspección para uso posterior
      localStorage.setItem('inspeccion_actual_id', selectedTask.id);
      localStorage.setItem('patente_validada', 'false');
      if (selectedTask.patente) {
        localStorage.setItem('patente_sistema', selectedTask.patente);
      }
      if (selectedTask.tipo || selectedTask.tipo_equipo) {
        localStorage.setItem('tipo_camion', selectedTask.tipo || selectedTask.tipo_equipo);
      }
      if (selectedTask.carroceria) {
        localStorage.setItem('carroceria_camion', selectedTask.carroceria);
      }

      const payload = { 
        id: selectedTask.id,
        camion_id: selectedTask.camion_id || selectedTask.camionId || null,
        estado_sincronizacion: 'en_curso',
        fecha_hora_inicio: new Date().toISOString(),
        fecha_hora_programada: selectedTask.fecha_hora_programada || selectedTask.fecha_programada || null,
        hora: selectedTask.hora || null,
        patente_sistema: selectedTask.patente || selectedTask.patente_sistema || null,
        patente: selectedTask.patente || selectedTask.patente_sistema || null,
        tipo: selectedTask.tipo || selectedTask.tipo_equipo || null,
        carroceria: selectedTask.carroceria || null,
        modelo: selectedTask.modelo || null,
        nombre_cliente: selectedTask.nombre_cliente || selectedTask.cliente || null,
        telefono_cliente: selectedTask.telefono_cliente || selectedTask.tel || null,
        ubicacion: selectedTask.ubicacion || selectedTask.dir || null,
        contacto: selectedTask.contacto || null,
        verificacion_coincide: null,
        flag_discrepancia: null,
        patente_real: null
      };

      const existente = await db.inspecciones.get(selectedTask.id);
      if (existente) {
        await db.inspecciones.update(selectedTask.id, payload);
      } else {
        await db.inspecciones.put(payload);
      }
    }
    router.push('/inspector/validacion-identidad');
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setAvatarUrl(URL.createObjectURL(file));
  };

  const userName = user?.nombre || 'Inspector';

  // ✅ Formatear fecha/hora
  const formatearHora = (fecha) => {
    if (!fecha) return '--:--';
    const d = new Date(fecha);
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className='min-h-screen bg-gray-50 pb-20 font-sans'>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={onFileChange} 
      />

      {/* HEADER */}
      <div className='relative overflow-hidden px-6 pt-10 pb-10 bg-gradient-to-br from-gray-900 via-red-950 to-black'>
        <div className='absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,#FF0000,transparent)] pointer-events-none' />

        <div className='relative z-10 flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            
            {/* AVATAR CON DROPDOWN */}
            <Dropdown 
              placement="bottom-start"
              classNames={{
                content: "p-0 border-none bg-white shadow-2xl rounded-2xl min-w-[280px]"
              }}
            >
              <DropdownTrigger>
                <div className='relative cursor-pointer transition-transform hover:scale-105 active:scale-95'>
                  <div className='w-16 h-16 rounded-full border-3 border-white/30 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center backdrop-blur-sm shadow-2xl p-1'>
                    <Avatar 
                      src={avatarUrl} 
                      className='w-full h-full'
                      classNames={{
                        base: "ring-2 ring-white/50"
                      }}
                    />
                  </div>
                </div>
              </DropdownTrigger>
              
              <DropdownMenu 
                aria-label="Perfil acciones" 
                variant="flat"
                className="p-0 gap-0"
                itemClasses={{
                  base: [
                    "rounded-lg",
                    "transition-colors",
                    "data-[hover=true]:bg-gray-100",
                    "px-4 py-3",
                    "mx-2 my-1"
                  ]
                }}
              >
                <DropdownItem 
                  key="profile" 
                  className="h-auto gap-0 px-4 py-4 mb-2 opacity-100 cursor-default hover:bg-transparent border-b border-gray-200 mx-0 my-0 rounded-none" 
                  textValue="Perfil"
                  isReadOnly
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar src={avatarUrl} className="w-12 h-12" />
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{userName}</p>
                      <p className="text-xs text-gray-500">Inspector</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">{user.email || 'inspector@petran.cl'}</p>
                </DropdownItem>
                
                <DropdownItem 
                  key="edit_photo" 
                  startContent={<Camera className="w-5 h-5 text-gray-600" />}
                  onPress={() => fileInputRef.current?.click()}
                  textValue="Cambiar Foto"
                  className="font-medium text-gray-700"
                >
                  Cambiar Foto
                </DropdownItem>

                <DropdownItem 
                  key="refresh" 
                  startContent={<RefreshCw className="w-5 h-5 text-gray-600" />}
                  onPress={handleRefresh}
                  textValue="Sincronizar"
                  className="font-medium text-gray-700"
                >
                  Sincronizar Datos
                </DropdownItem>
                
                <DropdownItem 
                  key="settings" 
                  startContent={<Settings className="w-5 h-5 text-gray-600" />}
                  onPress={() => setProfileModal(true)}
                  textValue="Configuración"
                  className="font-medium text-gray-700"
                >
                  Configuración
                </DropdownItem>
                
                <DropdownItem 
                  key="help" 
                  startContent={<HelpCircle className="w-5 h-5 text-gray-600" />}
                  textValue="Soporte"
                  className="font-medium text-gray-700 mb-2 border-b border-gray-200 pb-3 rounded-b-none"
                >
                  Soporte
                </DropdownItem>
                
                <DropdownItem 
                  key="logout" 
                  color="danger" 
                  className="text-red-600 font-semibold hover:bg-red-50"
                  startContent={<LogOut className="w-5 h-5" />}
                  onPress={handleLogout}
                  textValue="Cerrar Sesión"
                >
                  Cerrar Sesión
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>

            {/* TEXTO DEL USUARIO */}
            <div>
              <p className='text-red-400 text-xs font-bold uppercase tracking-widest mb-1'>Petran Inspecciones</p>
              <h1 className='text-white text-xl font-bold tracking-tight'>{userName}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setNotifOpen(true);
                loadNotifs().then(() => {
                  if (notifUnread > 0) markAllRead();
                });
              }}
              className="relative w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            >
              <Bell className="w-5 h-5" />
              {notifUnread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow">
                  {notifUnread}
                </span>
              )}
            </button>

            {/* BOTÓN SINCRONIZAR */}
            <Button
              isIconOnly
              variant='light'
              onPress={handleRefresh}
              isLoading={isSyncing}
              className='w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all'
            >
              <RefreshCw className='w-5 h-5' />
            </Button>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className='px-6 -mt-6 relative z-20'>
        <div className='grid grid-cols-3 gap-3'>
          <KpiCard icon={<Calendar size={20} />} label='Hoy' value={TASKS.length} />
          <KpiCard icon={<BarChart3 size={20} />} label='Efic.' value='98%' highlight />
          <KpiCard icon={<CheckCircle2 size={20} />} label='Mes' value='45' />
        </div>
      </div>

      {/* INSPECCIÓN ACTIVA O LISTA */}
      <div className='mt-6 px-6 space-y-4'>
        {inspeccionActiva && (
          <Card className='relative overflow-hidden border-none shadow-lg rounded-3xl px-4 py-3'>
            <div className='absolute inset-0 bg-gradient-to-r from-red-900 via-red-800 to-amber-700 opacity-95' />
            <div className='absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_45%)]' />
            <CardBody className='relative z-10 flex items-center justify-between gap-4 text-white'>
              <div className='flex flex-col gap-1'>
                <span className='text-[11px] font-bold tracking-[0.12em] uppercase text-white/80'>Inspección en curso</span>
                <span className='text-2xl font-black tracking-tight'>{patenteActiva}</span>
                <span className='text-xs text-white/80'>Completa antes de iniciar otra</span>
              </div>
              <Button
                className='bg-white text-red-900 font-bold rounded-xl px-4'
                onPress={() => router.push('/inspector/inspeccion/criticos')}
              >
                Continuar
              </Button>
            </CardBody>
          </Card>
        )}

        <div>
          <div className='flex justify-between items-end mb-4'>
            <h2 className='text-lg font-bold text-gray-800'>Asignaciones</h2>
            <span className='px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100'>
              {TASKS.length} Pendientes
            </span>
          </div>

          {TASKS.length === 0 ? (
            <div className='text-center py-12'>
              <Truck className='w-16 h-16 text-gray-300 mx-auto mb-3' />
            </div>
          ) : (
            <div className='relative'>
              {listadoDeshabilitado && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-3xl border border-amber-200 z-10 pointer-events-none" />
              )}
              <div className='space-y-3'>
                {TASKS.map((task, idx) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                  >
                    <Card
                      isPressable
                      onPress={() => handleTaskClick(task)}
                      className='w-full bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98]'
                    >
                      <CardBody className='p-4 flex flex-row items-center gap-4'>
                        <div className='flex flex-col items-center justify-center bg-gray-50 border border-gray-100 w-14 h-14 rounded-2xl min-w-[3.5rem]'>
                          <span className='text-base font-black text-gray-800'>
                            {formatearHora(task.fecha_hora_programada || task.fecha_hora_inicio)}
                          </span>
                        </div>

                        <div className='flex-1 min-w-0 text-left'>
                          <h3 className='font-bold text-gray-900 text-base truncate'>{task.patente || 'Sin patente'}</h3>
                          <p className='text-xs text-gray-500 truncate mb-1'>{task.nombre_cliente || 'Cliente no especificado'}</p>
                          <div className='flex items-center gap-1 text-[10px] font-medium text-gray-400 bg-gray-50 w-fit px-2 py-0.5 rounded-full border border-gray-100'>
                            <MapPin size={10} /> {task.ubicacion || 'Por definir'}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {task.revision_admin === 'REAGENDADA' && (
                            <Chip size="sm" color="warning" variant="flat" className="font-bold">
                              REAGENDADA
                            </Chip>
                          )}
                          {task.estado_sincronizacion === 'en_curso' && (
                            <Chip size="sm" color="warning" variant="flat" className="font-bold">EN PROCESO</Chip>
                          )}
                        </div>

                        <ChevronRight className='text-gray-300 w-5 h-5' />
                      </CardBody>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DETALLE */}
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        placement='bottom'
        backdrop='blur'
        classNames={{
          base: 'm-0 rounded-t-[2rem] sm:rounded-lg mb-0'
        }}
      >
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader className='pt-8 px-6 pb-2'>
                <div className='w-full flex items-start justify-between'>
                  <div>
                    <div className='text-xs font-bold text-gray-400 uppercase tracking-widest mb-1'>
                      Inspección Técnica
                    </div>
                    <div className='text-3xl font-black text-gray-900'>
                      {selectedTask?.patente || 'Sin patente'}
                    </div>
                  </div>
                  <div className='bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold mt-1 border border-red-100'>
                    PENDIENTE
                  </div>
                </div>
              </ModalHeader>

              <ModalBody className='px-6 py-4'>
                <div className='bg-white rounded-3xl border border-gray-200 shadow-sm p-5 space-y-4'>
                  <DetailRow label='Cliente' value={selectedTask?.nombre_cliente || 'N/A'} icon={<Truck size={16} />} />
                  <DetailRow label='Teléfono' value={selectedTask?.telefono_cliente || 'N/A'} icon={<Phone size={16} />} />
                  <DetailRow label='Ubicación' value={selectedTask?.ubicacion || 'N/A'} icon={<MapPin size={16} />} />
                </div>
              </ModalBody>

              <ModalFooter className='flex-col gap-3 px-6 pb-8 pt-2'>
                {/* BOTÓN LLAMAR - Solo si hay teléfono */}
                {selectedTask?.telefono_cliente && (
                  <Button 
                     className="w-full h-12 font-bold text-base bg-green-600 text-white rounded-2xl hover:bg-green-700"
                     onPress={() => window.location.href = `tel:${selectedTask.telefono_cliente}`}
                  >
             <div className="flex items-center justify-center gap-2">
        <Phone className="w-5 h-5" />
        <span>Llamar a Cliente</span>
      </div>
    </Button>
                )}

                {/* BOTÓN INICIAR */}
                <Button
                className='w-full h-14 font-bold text-lg bg-[#0f4c81] text-white rounded-2xl shadow-xl shadow-sky-200 hover:bg-sky-900 active:scale-[0.98]'
                onPress={handleStartInspection}
                >
                <div className="flex items-center justify-center gap-2">
                    <Truck className='w-6 h-6' />
                    <span>Iniciar Inspección</span>
                </div>
                </Button>

              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* MODAL PERFIL */}
      <Modal isOpen={profileModal} onOpenChange={setProfileModal}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Editar perfil</ModalHeader>
              <ModalBody className="space-y-3">
                <Input
                  label="Nombre"
                  value={profileForm.nombre}
                  onChange={(e) => setProfileForm(f => ({ ...f, nombre: e.target.value }))}
                />
                <Input
                  label="Email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(f => ({ ...f, email: e.target.value }))}
                />
                <Input
                  label="Contraseña"
                  type="password"
                  value={profileForm.password}
                  onChange={(e) => setProfileForm(f => ({ ...f, password: e.target.value }))}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancelar</Button>
                <Button color="primary" onPress={handleProfileSave}>Guardar</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* MODAL NOTIFICACIONES */}
      <Modal isOpen={notifOpen} onOpenChange={setNotifOpen} placement="center" backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center justify-between">
                <span className="font-bold text-gray-900">Notificaciones</span>
                {notifs.length > 0 && (
                  <Button size="sm" variant="light" onPress={markAllRead}>
                    Marcar todo leído
                  </Button>
                )}
              </ModalHeader>
              <ModalBody className="space-y-3">
                {notifLoading ? (
                  <div className="text-center text-sm text-gray-500">Cargando...</div>
                ) : notifs.length === 0 ? (
                  <div className="text-center text-sm text-gray-500">Sin notificaciones</div>
                ) : (
                  notifs.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-2xl border p-3 ${
                        n.leida ? "border-gray-200 bg-white" : "border-amber-200 bg-amber-50"
                      }`}
                    >
                      <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-gray-500">
                        {n.tipo || "Aviso"}
                      </div>
                      <div className="text-sm font-bold text-gray-900 mt-1">{n.titulo}</div>
                      {n.mensaje && <div className="text-xs text-gray-600 mt-1">{n.mensaje}</div>}
                      <div className="text-[11px] text-gray-400 mt-2">
                        {n.created_at ? new Date(n.created_at).toLocaleString("es-CL") : ""}
                      </div>
                    </div>
                  ))
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cerrar</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

// Componentes Auxiliares
function KpiCard({ icon, label, value, highlight }) {
  return (
    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm h-24 flex flex-col items-center justify-center text-center'>
      <div className={`mb-1 ${highlight ? 'text-[#7f1d1d]' : 'text-gray-400'}`}>{icon}</div>
      <span className='text-xl font-black text-gray-800 leading-none'>{value}</span>
      <span className='text-[10px] font-bold text-gray-400 uppercase mt-1'>{label}</span>
    </div>
  )
}

function DetailRow({ label, value, icon }) {
  return (
    <div className='flex justify-between items-center border-b border-gray-100 last:border-0 pb-2 last:pb-0'>
      <div className='flex items-center gap-2 text-gray-400'>
        {icon}
        <span className='text-xs font-medium uppercase tracking-wide'>{label}</span>
      </div>
      <span className='text-sm font-bold text-gray-800'>{value}</span>
    </div>
  )
}
