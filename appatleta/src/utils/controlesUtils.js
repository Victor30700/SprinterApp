// src/utils/controlesUtils.js

/**
 * Dado un objeto controles { key: [{fecha, valor, unidad, sensaciones}, ...], ... }
 * y una clave de prueba (e.g. "100m" o "120m"),
 * devuelve el valor más reciente (por fecha) o null si no hay.
 */
export function getLatestTime(key, controles) {
  const registros = controles[key] || [];
  if (registros.length === 0) return null;
  const sorted = [...registros].sort((a, b) =>
    b.fecha.localeCompare(a.fecha)
  );
  return sorted[0].valor;
}
