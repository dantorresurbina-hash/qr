/**
 * Seguridad y Configuración de Criptografía
 * Centraliza las llaves y secretos para evitar inconsistencias entre componentes.
 */

export const SECURITY_CONFIG = {
  // Sal secreta para la generación de firmas HMAC-SHA256 en códigos QR
  // IMPORTANTE: En un entorno de producción real, esto debería inyectarse vía variables de entorno.
  CLIENT_SALT: 'yute_impresiones_secure_2024_auth_key_v1',
  
  // Tiempo de expiración para considerar datos como "obsoletos" (en milisegundos)
  STALE_DATA_THRESHOLD: 120 * 60 * 1000, // 2 horas
};
