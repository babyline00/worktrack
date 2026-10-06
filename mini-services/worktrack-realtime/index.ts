import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface LiveUpdate {
  type: 'checkin' | 'checkout' | 'leave' | 'alert' | 'dashboard-refresh'
  employeeId?: string
  employeeName?: string
  timestamp: string
  data?: any
}

io.on('connection', (socket) => {
  console.log(`[WorkTrack RT] Client connected: ${socket.id}`)

  socket.on('subscribe', (channel: string) => {
    socket.join(channel)
    console.log(`[WorkTrack RT] ${socket.id} subscribed to ${channel}`)
  })

  socket.on('unsubscribe', (channel: string) => {
    socket.leave(channel)
  })

  // Broadcast events received from any client (e.g. after API POST)
  socket.on('checkin', (data: { employeeId: string; employeeName: string }) => {
    const update: LiveUpdate = {
      type: 'checkin',
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      timestamp: new Date().toISOString(),
      data,
    }
    io.to('dashboard').emit('live-update', update)
    io.to('live-attendance').emit('live-update', update)
    console.log(`[WorkTrack RT] checkin broadcast: ${data.employeeName}`)
  })

  socket.on('checkout', (data: { employeeId: string; employeeName: string }) => {
    const update: LiveUpdate = {
      type: 'checkout',
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      timestamp: new Date().toISOString(),
      data,
    }
    io.to('dashboard').emit('live-update', update)
    io.to('live-attendance').emit('live-update', update)
    console.log(`[WorkTrack RT] checkout broadcast: ${data.employeeName}`)
  })

  socket.on('leave-update', (data: any) => {
    const update: LiveUpdate = {
      type: 'leave',
      timestamp: new Date().toISOString(),
      data,
    }
    io.to('dashboard').emit('live-update', update)
    io.to('leave-management').emit('live-update', update)
  })

  // Heartbeat for "updated X seconds ago" indicator
  socket.on('heartbeat', () => {
    socket.emit('heartbeat-ack', { timestamp: new Date().toISOString() })
  })

  socket.on('disconnect', () => {
    console.log(`[WorkTrack RT] Client disconnected: ${socket.id}`)
  })

  socket.on('error', (error) => {
    console.error(`[WorkTrack RT] Socket error (${socket.id}):`, error)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[WorkTrack RT] WebSocket server running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[WorkTrack RT] SIGTERM received, shutting down...')
  httpServer.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('[WorkTrack RT] SIGINT received, shutting down...')
  httpServer.close(() => process.exit(0))
})
