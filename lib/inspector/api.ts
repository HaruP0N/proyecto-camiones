const ENV_API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
// En browser siempre usamos el mismo origen para evitar CORS
const API_BASE =
  typeof window !== "undefined"
    ? window.location.origin
    : ENV_API_BASE;

export async function loginStaff(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/staff/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "Error de conexión");
  }

  return data;
}

export async function getAsignacionesHoy() {
  const res = await fetch(`${API_BASE}/api/inspector/inspecciones/hoy`, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error cargando asignaciones");
  const data = await res.json();
  return Array.isArray(data?.data) ? data.data : [];
}
