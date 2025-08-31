// Конфигурация WebSocket сервера для VPS
module.exports = {
  // Основные настройки
  port: process.env.PORT || 8080,
  host: process.env.HOST || '0.0.0.0',
  
  // Настройки безопасности
  maxConnections: process.env.MAX_CONNECTIONS || 1000,
  heartbeatInterval: process.env.HEARTBEAT_INTERVAL || 30000,
  
  // Логирование
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // WebSocket настройки
  ws: {
    perMessageDeflate: false,
    maxPayload: 1024 * 1024, // 1MB
  }
};
