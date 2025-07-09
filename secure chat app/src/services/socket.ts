import { io, Socket } from 'socket.io-client';
import type { User } from './api';

export interface Message {
  id: string;
  senderId: string;
  senderUsername: string;
  encryptedContent: string;
  roomId: string;
  timestamp: string;
}

export interface TypingUser {
  userId: string;
  username: string;
}

export class SocketService {
  private socket: Socket | null = null;
  private messageCallbacks: Array<(message: Message) => void> = [];
  private onlineUsersCallbacks: Array<(users: User[]) => void> = [];
  private typingCallbacks: Array<(user: TypingUser) => void> = [];
  private stopTypingCallbacks: Array<(userId: string) => void> = [];
  private messageHistoryCallbacks: Array<(messages: Message[]) => void> = [];

  connect(token: string) {
    if (this.socket?.connected) return;

    this.socket = io('http://localhost:3001', {
      auth: { token }
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('receive_message', (message: Message) => {
      this.messageCallbacks.forEach(callback => callback(message));
    });

    this.socket.on('users_online', (users: User[]) => {
      this.onlineUsersCallbacks.forEach(callback => callback(users));
    });

    this.socket.on('user_typing', (user: TypingUser) => {
      this.typingCallbacks.forEach(callback => callback(user));
    });

    this.socket.on('user_stop_typing', ({ userId }: { userId: string }) => {
      this.stopTypingCallbacks.forEach(callback => callback(userId));
    });

    this.socket.on('message_history', (messages: Message[]) => {
      this.messageHistoryCallbacks.forEach(callback => callback(messages));
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinRoom(roomId: string) {
    this.socket?.emit('join_room', roomId);
  }

  sendMessage(roomId: string, encryptedContent: string) {
    this.socket?.emit('send_message', { roomId, encryptedContent });
  }

  startTyping(roomId: string) {
    this.socket?.emit('typing_start', { roomId });
  }

  stopTyping(roomId: string) {
    this.socket?.emit('typing_stop', { roomId });
  }

  onMessage(callback: (message: Message) => void) {
    this.messageCallbacks.push(callback);
  }

  onOnlineUsers(callback: (users: User[]) => void) {
    this.onlineUsersCallbacks.push(callback);
  }

  onTyping(callback: (user: TypingUser) => void) {
    this.typingCallbacks.push(callback);
  }

  onStopTyping(callback: (userId: string) => void) {
    this.stopTypingCallbacks.push(callback);
  }

  onMessageHistory(callback: (messages: Message[]) => void) {
    this.messageHistoryCallbacks.push(callback);
  }

  removeAllListeners() {
    this.messageCallbacks = [];
    this.onlineUsersCallbacks = [];
    this.typingCallbacks = [];
    this.stopTypingCallbacks = [];
    this.messageHistoryCallbacks = [];
  }
}

export const socketService = new SocketService();