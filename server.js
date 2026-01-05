const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store orders in memory (in production, use a database)
let orders = [];
let users = [];
let currentUser = null;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'KhachHang.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'Addmin.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Send current orders to newly connected client
  socket.emit('loadOrders', orders);

  // Handle new booking from client
  socket.on('newBooking', (bookingData) => {
    if (!bookingData.userId || !users.find(u => u.id === bookingData.userId)) {
      socket.emit('authError', 'You must be logged in to book');
      return;
    }
    console.log('New booking received:', bookingData);
    orders.push(bookingData);

    // Broadcast to all connected clients (including admin)
    io.emit('orderUpdate', bookingData);
  });

  // Handle order confirmation from admin
  socket.on('confirmOrder', (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.status = 'Đã xác nhận';
      io.emit('orderConfirmed', orderId);
    }
  });

  // Handle payment status updates from admin
  socket.on('updatePaymentStatus', (data) => {
    const { orderId, depositPaid, fullPaid } = data;
    const order = orders.find(o => o.id === orderId);
    if (order) {
      if (depositPaid !== undefined) {
        order.depositPaid = depositPaid;
      }
      if (fullPaid !== undefined) {
        order.fullPaid = fullPaid;
      }
      io.emit('paymentStatusUpdated', { orderId, depositPaid: order.depositPaid, fullPaid: order.fullPaid });
    }
  });

  // Handle user registration
  socket.on('register', (userData) => {
    const { name, email, password } = userData;

    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      socket.emit('registerError', 'Email đã được sử dụng');
      return;
    }

    // Create new user
    const newUser = {
      id: users.length + 1,
      name,
      email,
      password // In production, hash the password
    };

    users.push(newUser);
    socket.emit('registerSuccess', { id: newUser.id, name: newUser.name, email: newUser.email });
  });

  // Handle user login
  socket.on('login', (loginData) => {
    const { email, password } = loginData;

    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      socket.emit('loginSuccess', { id: user.id, name: user.name, email: user.email });
    } else {
      socket.emit('loginError', 'Email hoặc mật khẩu không đúng');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Client: http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
});
