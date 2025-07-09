import React, { useState, useEffect, useRef } from 'react';
import { Send, Shield, Users, LogOut, Loader } from 'lucide-react';
import { socketService } from '../services/socket';
import { ApiService, type User } from '../services/api';
import { ChatCrypto } from '../utils/crypto';
import type { Message, TypingUser } from '../services/socket';

interface ChatInterfaceProps {
  currentUser: User;
  onLogout: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ currentUser, onLogout }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Initialize crypto
    ChatCrypto.generateKeyPair();
    ChatCrypto.generateSymmetricKey();

    // Connect to socket
    const token = ApiService.getToken();
    if (token) {
      socketService.connect(token);
    }

    // Load online users
    loadOnlineUsers();

    // Set up socket listeners
    socketService.onMessage(handleReceiveMessage);
    socketService.onOnlineUsers(setOnlineUsers);
    socketService.onTyping(handleUserTyping);
    socketService.onStopTyping(handleUserStopTyping);
    socketService.onMessageHistory(handleMessageHistory);

    return () => {
      socketService.removeAllListeners();
      socketService.disconnect();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadOnlineUsers = async () => {
    const users = await ApiService.getOnlineUsers();
    setOnlineUsers(users);
  };

  const handleReceiveMessage = async (message: Message) => {
    setMessages(prev => [...prev, message]);
    
    // Decrypt message
    try {
      const decrypted = await ChatCrypto.decryptMessage(message.encryptedContent);
      setDecryptedMessages(prev => new Map(prev).set(message.id, decrypted));
    } catch (error) {
      console.error('Failed to decrypt message:', error);
    }
  };

  const handleMessageHistory = async (history: Message[]) => {
    setMessages(history);
    
    // Decrypt all messages
    const decryptedMap = new Map();
    for (const message of history) {
      try {
        const decrypted = await ChatCrypto.decryptMessage(message.encryptedContent);
        decryptedMap.set(message.id, decrypted);
      } catch (error) {
        console.error('Failed to decrypt message:', error);
      }
    }
    setDecryptedMessages(decryptedMap);
  };

  const handleUserTyping = (user: TypingUser) => {
    setTypingUsers(prev => {
      const exists = prev.find(u => u.userId === user.userId);
      if (!exists) {
        return [...prev, user];
      }
      return prev;
    });
  };

  const handleUserStopTyping = (userId: string) => {
    setTypingUsers(prev => prev.filter(u => u.userId !== userId));
  };

  const selectUser = (user: User) => {
    setSelectedUser(user);
    const roomId = ChatCrypto.generateRoomId(currentUser.id, user.id);
    setCurrentRoomId(roomId);
    setMessages([]);
    setDecryptedMessages(new Map());
    socketService.joinRoom(roomId);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;

    try {
      const encryptedContent = await ChatCrypto.encryptMessage(newMessage.trim());
      socketService.sendMessage(currentRoomId, encryptedContent);
      setNewMessage('');
      handleStopTyping();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleTyping = () => {
    if (!isTyping && currentRoomId) {
      setIsTyping(true);
      socketService.startTyping(currentRoomId);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 1000);
  };

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      socketService.stopTyping(currentRoomId);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex">
      {/* Sidebar */}
      <div className="w-80 bg-white/10 backdrop-blur-lg border-r border-white/20">
        {/* Profile Header */}
        <div className="p-6 border-b border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">
                  {currentUser.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="text-white font-semibold">{currentUser.username}</h3>
                <p className="text-gray-400 text-sm">{currentUser.email}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Online Users */}
        <div className="p-4">
          <div className="flex items-center space-x-2 mb-4">
            <Users className="w-5 h-5 text-green-400" />
            <h4 className="text-white font-semibold">Online Users ({onlineUsers.length})</h4>
          </div>
          
          <div className="space-y-2">
            {onlineUsers.map(user => (
              <button
                key={user.id}
                onClick={() => selectUser(user)}
                className={`w-full p-3 rounded-lg text-left transition-all duration-200 ${
                  selectedUser?.id === user.id
                    ? 'bg-blue-500/30 border border-blue-500/50'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900"></div>
                  </div>
                  <div>
                    <p className="text-white font-medium">{user.username}</p>
                    <p className="text-gray-400 text-xs">Online</p>
                  </div>
                </div>
              </button>
            ))}
            
            {onlineUsers.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-400">No other users online</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="p-6 border-b border-white/20 bg-white/5 backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">
                      {selectedUser.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{selectedUser.username}</h3>
                    <p className="text-green-400 text-sm flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      Online
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-gray-400">
                  <Shield className="w-5 h-5" />
                  <span className="text-sm">End-to-end encrypted</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                      message.senderId === currentUser.id
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                        : 'bg-white/10 text-white border border-white/20'
                    }`}
                  >
                    <p className="break-words">
                      {decryptedMessages.get(message.id) || (
                        <div className="flex items-center space-x-2">
                          <Loader className="w-4 h-4 animate-spin" />
                          <span>Decrypting...</span>
                        </div>
                      )}
                    </p>
                    <p className={`text-xs mt-2 ${
                      message.senderId === currentUser.id ? 'text-blue-100' : 'text-gray-400'
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              {/* Typing Indicators */}
              {typingUsers.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-white/10 px-4 py-3 rounded-2xl border border-white/20">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-gray-400 text-sm">
                        {typingUsers.map(u => u.username).join(', ')} typing...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-6 border-t border-white/20 bg-white/5 backdrop-blur-lg">
              <div className="flex items-center space-x-4">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                <Users className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-2xl font-semibold text-white mb-2">Welcome to Secure Chat</h3>
              <p className="text-gray-400 max-w-md">
                Select a user from the sidebar to start a secure, end-to-end encrypted conversation.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};