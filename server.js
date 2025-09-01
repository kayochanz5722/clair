const WebSocket = require('ws');
const http = require('http');

// Создаем HTTP сервер
const server = http.createServer();

// Создаем WebSocket сервер
const wss = new WebSocket.Server({ server });

// Храним подключенных пользователей и их чаты
const connectedUsers = new Map(); // ws -> { userId, chatIds: Set }
const chatRooms = new Map(); // chatId -> Set of ws

console.log('🚀 WebSocket сервер запускается...');

wss.on('connection', (ws, req) => {
  console.log('💬 Новое WebSocket подключение');
  
  let userId = null;
  let userChatIds = new Set();
  
  // Обрабатываем входящие сообщения
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📨 Получено сообщение:', message);
      
      switch (message.type) {
        case 'auth':
          // Аутентификация пользователя
          userId = message.data.user_id;
          
          // Добавляем пользователя в общий список подключенных
          connectedUsers.set(ws, { userId, chatIds: userChatIds });
          
          console.log(`🔐 Пользователь ${userId} аутентифицирован`);
          
          // Отправляем подтверждение
          ws.send(JSON.stringify({
            type: 'auth_success',
            data: { user_id: userId }
          }));
          break;
          
        case 'join_chat':
          // Пользователь присоединяется к чату
          const chatId = message.data.chat_id;
          userChatIds.add(chatId);
          
          // Создаем комнату чата если её нет
          if (!chatRooms.has(chatId)) {
            chatRooms.set(chatId, new Set());
          }
          chatRooms.get(chatId).add(ws);
          
          // Обновляем информацию о пользователе
          connectedUsers.set(ws, { userId, chatIds: userChatIds });
          
          console.log(`🔗 Пользователь ${userId} присоединился к чату ${chatId}`);
          break;
          
        case 'leave_chat':
          // Пользователь покидает чат
          const leaveChatId = message.data.chat_id;
          userChatIds.delete(leaveChatId);
          
          // Удаляем пользователя из комнаты чата
          if (chatRooms.has(leaveChatId)) {
            chatRooms.get(leaveChatId).delete(ws);
            
            // Если комната пуста, удаляем её
            if (chatRooms.get(leaveChatId).size === 0) {
              chatRooms.delete(leaveChatId);
            }
          }
          
          // Обновляем информацию о пользователе
          connectedUsers.set(ws, { userId, chatIds: userChatIds });
          
          console.log(`🔌 Пользователь ${userId} покинул чат ${leaveChatId}`);
          break;
          
        case 'new_message':
          // Пересылаем сообщение всем участникам чата, кроме отправителя
          const messageChatId = message.data.chat_id;
          const chatRoom = chatRooms.get(messageChatId);
          
          if (chatRoom) {
            const messageToSend = JSON.stringify({
              type: 'new_message',
              data: message.data
            });
            
            chatRoom.forEach((client) => {
              // НЕ отправляем сообщение отправителю
              if (client.readyState === WebSocket.OPEN && client !== ws) {
                client.send(messageToSend);
              }
            });
            
            console.log(`💬 Сообщение отправлено в чат ${messageChatId} (исключая отправителя)`);
          }
          break;
          
        case 'typing_status':
          // Пересылаем статус печатания
          const typingChatId = message.data.chat_id;
          const typingRoom = chatRooms.get(typingChatId);
          
          if (typingRoom) {
            const typingMessage = JSON.stringify({
              type: 'user_typing',
              data: message.data
            });
            
            typingRoom.forEach((client) => {
              if (client.readyState === WebSocket.OPEN && client !== ws) {
                client.send(typingMessage);
              }
            });
            
            console.log(`⌨️ Статус печатания отправлен в чат ${typingChatId}`);
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
    console.log(`🔌 Пользователь ${userId} отключился`);
    
    // Удаляем пользователя из всех чатов
    if (userChatIds.size > 0) {
      userChatIds.forEach(chatId => {
        if (chatRooms.has(chatId)) {
          chatRooms.get(chatId).delete(ws);
          
          // Если комната пуста, удаляем её
          if (chatRooms.get(chatId).size === 0) {
            chatRooms.delete(chatId);
          }
        }
      });
    }
    
    connectedUsers.delete(ws);
  });
  
  // Обрабатываем ошибки
  ws.on('error', (error) => {
    console.error('❌ WebSocket ошибка:', error);
  });
});

// Запускаем сервер
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 WebSocket сервер запущен на порту ${PORT}`);
  console.log(`🔗 Подключение: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Останавливаем WebSocket сервер...');
  wss.close(() => {
    console.log('✅ WebSocket сервер остановлен');
    process.exit(0);
  });
});
