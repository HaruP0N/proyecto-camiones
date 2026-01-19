export const BODY_TYPES = [
  { value: "CAMION_CON_CARRO", label: "Camión con carro" },
  { value: "CARRO_REEFER", label: "Carro reefer" },
  { value: "CAMARA_DE_FRIO", label: "Cámara de frío" },
  { value: "CAMION_CARRO_PAQUETERO", label: "Camión carro paquetero" },
] as const

export type BodyType = (typeof BODY_TYPES)[number]["value"]
