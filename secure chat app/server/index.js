import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';
const PORT = process.env.PORT || 3001;

// In-memory storage (use a real database in production)
const users = new Map();
const onlineUsers = new Map();
const chatRooms = new Map();
const messageHistory = new Map();

app.use(cors());
app.use(express.json());

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = Array.from(users.values()).find(u => u.email === email || u.username === username);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const userId = Date.now().toString();
    const user = {
      id: userId,
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    users.set(userId, user);

    // Generate JWT
    const token = jwt.sign(
      { id: userId, username, email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: { id: userId, username, email }
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = Array.from(users.values()).find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get online users
app.get('/api/users/online', authenticateToken, (req, res) => {
  const onlineUsersList = Array.from(onlineUsers.values()).filter(u => u.id !== req.user.id);
  res.json(onlineUsersList);
});

// Socket.io connection handling
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    socket.userId = decoded.id;
    socket.username = decoded.username;
    socket.email = decoded.email;
    next();
  });
});

io.on('connection', (socket) => {
  console.log(`User ${socket.username} connected`);

  // Add user to online users
  onlineUsers.set(socket.userId, {
    id: socket.userId,
    username: socket.username,
    email: socket.email,
    socketId: socket.id
  });

  // Broadcast updated online users list
  io.emit('users_online', Array.from(onlineUsers.values()));

  // Handle joining chat rooms
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    
    // Send message history for this room
    const history = messageHistory.get(roomId) || [];
    socket.emit('message_history', history);
  });

  // Handle sending messages
  socket.on('send_message', (data) => {
    const messageData = {
      id: Date.now().toString(),
      senderId: socket.userId,
      senderUsername: socket.username,
      encryptedContent: data.encryptedContent,
      roomId: data.roomId,
      timestamp: new Date().toISOString()
    };

    // Store message in history
    if (!messageHistory.has(data.roomId)) {
      messageHistory.set(data.roomId, []);
    }
    messageHistory.get(data.roomId).push(messageData);

    // Broadcast to room
    io.to(data.roomId).emit('receive_message', messageData);
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    socket.to(data.roomId).emit('user_typing', {
      userId: socket.userId,
      username: socket.username
    });
  });

  socket.on('typing_stop', (data) => {
    socket.to(data.roomId).emit('user_stop_typing', {
      userId: socket.userId
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User ${socket.username} disconnected`);
    onlineUsers.delete(socket.userId);
    io.emit('users_online', Array.from(onlineUsers.values()));
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});