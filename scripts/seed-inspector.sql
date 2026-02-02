SELECT i.id AS inspeccion_id, c.patente, c.marca, c.modelo, i.estado, i.fecha_programada
FROM inspecciones i
JOIN camiones c ON i.camion_id = c.id
JOIN usuarios u ON i.inspector_id = u.id
WHERE u.email = 'juako332@gmail.com'
  AND i.estado = 'PROGRAMADA'
  AND CAST(i.fecha_programada AS DATE) = CAST(GETDATE() AS DATE)
ORDER BY i.fecha_programada DESC;


select from 