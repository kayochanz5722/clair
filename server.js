const WebSocket = require('ws');
const http = require('http');
const config = require('./config');

// Создаем HTTP сервер
const server = http.createServer();

// Создаем WebSocket сервер с настройками
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: config.ws.perMessageDeflate,
  maxPayload: config.ws.maxPayload,
});

// Храним подключенных пользователей
const connectedUsers = new Map();
const chatRooms = new Map();

console.log('🚀 WebSocket сервер запускается...');

wss.on('connection', (ws, req) => {
  console.log('💬 Новое WebSocket подключение');
  
  let userId = null;
  let chatId = null;
  
  // Обрабатываем входящие сообщения
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📨 Получено сообщение:', message);
      
      switch (message.type) {
        case 'auth':
          // Аутентификация пользователя
          userId = message.data.user_id;
          chatId = message.data.chat_id;
          
          // Добавляем пользователя в комнату чата
          if (!chatRooms.has(chatId)) {
            chatRooms.set(chatId, new Set());
          }
          chatRooms.get(chatId).add(ws);
          connectedUsers.set(ws, { userId, chatId });
          
          console.log(`🔐 Пользователь ${userId} подключен к чату ${chatId}`);
          
          // Отправляем подтверждение
          ws.send(JSON.stringify({
            type: 'auth_success',
            data: { user_id: userId, chat_id: chatId }
          }));
          break;
          
        case 'new_message':
          // Пересылаем сообщение всем участникам чата
          let targetChatId = chatId || message.data.chat_id;
          
          if (targetChatId) {
            // Создаем комнату если её нет
            if (!chatRooms.has(targetChatId)) {
              chatRooms.set(targetChatId, new Set());
            }
            
            // Добавляем текущее соединение в комнату если его там нет
            if (!chatRooms.get(targetChatId).has(ws)) {
              chatRooms.get(targetChatId).add(ws);
            }
            
            // Убеждаемся, что у нас есть chatId для сообщения
            const messageData = {
              ...message.data,
              chat_id: targetChatId
            };
            
            const messageToSend = JSON.stringify({
              type: 'new_message',
              data: messageData
            });
            
            // Отправляем сообщение всем участникам чата, кроме отправителя
            chatRooms.get(targetChatId).forEach((client) => {
              if (client.readyState === WebSocket.OPEN && client !== ws) {
                client.send(messageToSend);
                console.log(`💬 Сообщение отправлено клиенту в чате ${targetChatId}`);
              }
            });
            
            console.log(`💬 Сообщение отправлено в чат ${targetChatId}:`, messageData.content);
          } else {
            console.log('❌ Не удалось определить chatId для сообщения');
          }
          break;
          
        case 'typing_status':
          // Пересылаем статус печатания
          let typingChatId = chatId || message.data.chat_id;
          
          if (typingChatId) {
            // Создаем комнату если её нет
            if (!chatRooms.has(typingChatId)) {
              chatRooms.set(typingChatId, new Set());
            }
            
            // Добавляем текущее соединение в комнату если его там нет
            if (!chatRooms.get(typingChatId).has(ws)) {
              chatRooms.get(typingChatId).add(ws);
            }
            
            // Убеждаемся, что у нас есть все необходимые данные
            const typingData = {
              ...message.data,
              chat_id: typingChatId
            };
            
            const typingMessage = JSON.stringify({
              type: 'user_typing',
              data: typingData
            });
            
            // Отправляем статус печатания всем участникам чата, кроме отправителя
            chatRooms.get(typingChatId).forEach((client) => {
              if (client.readyState === WebSocket.OPEN && client !== ws) {
                client.send(typingMessage);
                console.log(`⌨️ Статус печатания отправлен клиенту в чате ${typingChatId}`);
              }
            });
            
            console.log(`⌨️ Статус печатания отправлен в чат ${typingChatId}: пользователь ${typingData.user_id} ${typingData.is_typing ? 'печатает' : 'не печатает'}`);
          } else {
            console.log('❌ Не удалось определить chatId для статуса печатания');
          }
          break;
          
        default:
          console.log('❓ Неизвестный тип сообщения:', message.type);
      }
    } catch (error) {
      console.error('❌ Ошибка обработки сообщения:', error);
    }
  });
  
  // Обрабатываем отключение
  ws.on('close', () => {
    console.log(`🔌 Пользователь ${userId} отключился от чата ${chatId}`);
    
    // Удаляем пользователя из комнаты
    if (chatId && chatRooms.has(chatId)) {
      chatRooms.get(chatId).delete(ws);
      
      // Если комната пуста, удаляем её
      if (chatRooms.get(chatId).size === 0) {
        chatRooms.delete(chatId);
      }
    }
    
    connectedUsers.delete(ws);
  });
  
  // Обрабатываем ошибки
  ws.on('error', (error) => {
    console.error('❌ WebSocket ошибка:', error);
  });
});

// Запускаем сервер
server.listen(config.port, config.host, () => {
  console.log(`🚀 WebSocket сервер запущен на ${config.host}:${config.port}`);
  console.log(`🔗 Локальное подключение: ws://localhost:${config.port}`);
  console.log(`🌐 Внешнее подключение: ws://your-vps-ip:${config.port}`);
  console.log(`🔒 Для продакшена используйте: wss://your-domain.com`);
  console.log(`⚙️ Максимум подключений: ${config.maxConnections}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Останавливаем WebSocket сервер...');
  wss.close(() => {
    console.log('✅ WebSocket сервер остановлен');
    process.exit(0);
  });
});
