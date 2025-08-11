import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
let waiting = new Set();
const partners = new Map();

function pairSockets(a, b) {
  partners.set(a, b);
  partners.set(b, a);
  io.to(a).emit('paired', { partnerId: b });
  io.to(b).emit('paired', { partnerId: a });
}

io.on('connection', (socket) => {
  socket.on('find-partner', () => {
    waiting.delete(socket.id);
    const iterator = waiting.values();
    const next = iterator.next();
    if (!next.done) {
      const otherId = next.value;
      waiting.delete(otherId);
      pairSockets(socket.id, otherId);
    } else {
      waiting.add(socket.id);
      socket.emit('waiting');
    }
  });

  socket.on('cancel-waiting', () => waiting.delete(socket.id));

  socket.on('disconnect', () => {
    waiting.delete(socket.id);
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      partners.delete(partnerId);
      partners.delete(socket.id);
      io.to(partnerId).emit('partner-left');
    }
  });

  socket.on('signal', ({ to, data }) => {
    if (!to) return;
    io.to(to).emit('signal', { from: socket.id, data });
  });

  socket.on('skip', () => {
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-left');
      partners.delete(partnerId);
      partners.delete(socket.id);
      waiting.add(partnerId);
    }
    waiting.add(socket.id);
    const ids = Array.from(waiting);
    if (ids.length >= 2) {
      const a = ids.shift();
      const b = ids.shift();
      waiting.delete(a);
      waiting.delete(b);
      pairSockets(a, b);
    }
  });
});

app.get('/health', (req, res) => res.send('OK'));

server.listen(PORT, () => console.log(`Server running on ${PORT}`));