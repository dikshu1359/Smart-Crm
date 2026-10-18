import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import jwt from 'jsonwebtoken';
import dbManager from './utils/DatabaseManager.js';

const JWT_SECRET = process.env.JWT_SECRET || 'smart-institutional-crm-super-secret-jwt-key';

// In-memory active connections: userId -> Set<WebSocket>
const userSockets = new Map();
// Active calls: callId -> CallSession
const activeCalls = new Map();

/**
 * CallSession structure:
 * {
 *   callId: string,
 *   callerId: string,
 *   callerName: string,
 *   callerRole: string,
 *   recipientId: string,
 *   recipientName: string,
 *   recipientRole: string,
 *   type: 'audio' | 'video',
 *   status: 'ringing' | 'connected' | 'ended' | 'declined' | 'missed',
 *   startedAt: Date,
 *   connectedAt: Date | null,
 *   databaseName: string,
 *   offerSdp: any,
 *   answerSdp: any,
 *   iceCandidates: any[],
 * }
 */

export function setupWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const parsedUrl = url.parse(request.url, true);
      const pathname = parsedUrl.pathname;

      if (pathname === '/ws' || pathname === '/ws/') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
        return;
      }
      // If pathname starts with /vite-hmr or other paths, let other handlers (like Vite) handle it
    } catch (err) {
      console.warn('[WebSocket Upgrade Error]', err);
      socket.destroy();
    }
  });

  wss.on('connection', (ws, req) => {
    const parsedUrl = url.parse(req.url, true);
    const token = parsedUrl.query.token || req.headers['sec-websocket-protocol'];
    let user = null;

    if (token) {
      try {
        user = jwt.verify(token, JWT_SECRET);
        ws.user = user;
        const userId = String(user.id || user._id);
        ws.userId = userId;

        if (!userSockets.has(userId)) {
          userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(ws);

        // Send connection ack
        sendEvent(ws, 'connected', {
          userId,
          fullName: user.fullName,
          role: user.role,
          databaseName: user.databaseName,
        });

        // If user has an active incoming call, notify them immediately upon connection
        for (const [callId, call] of activeCalls.entries()) {
          if (String(call.recipientId) === userId && call.status === 'ringing') {
            sendEvent(ws, 'call:incoming', call);
          }
        }
      } catch (err) {
        // Allow unauthenticated connection or send auth error
        sendEvent(ws, 'auth_error', { message: 'Invalid or expired token' });
      }
    }

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (rawMessage) => {
      try {
        const data = JSON.parse(rawMessage.toString());
        const { event, payload } = data;

        if (event === 'ping') {
          sendEvent(ws, 'pong', { time: Date.now() });
          return;
        }

        if (event === 'auth') {
          try {
            const authUser = jwt.verify(payload.token, JWT_SECRET);
            ws.user = authUser;
            const uId = String(authUser.id || authUser._id);
            ws.userId = uId;
            if (!userSockets.has(uId)) {
              userSockets.set(uId, new Set());
            }
            userSockets.get(uId).add(ws);
            sendEvent(ws, 'auth_success', { userId: uId, fullName: authUser.fullName });

            // Check pending calls
            for (const [, call] of activeCalls.entries()) {
              if (String(call.recipientId) === uId && call.status === 'ringing') {
                sendEvent(ws, 'call:incoming', call);
              }
            }
          } catch (e) {
            sendEvent(ws, 'auth_error', { message: e.message });
          }
          return;
        }

        // WebRTC Signaling: offer / answer / ice-candidate
        if (event === 'call:signal') {
          const { callId, targetUserId, signal } = payload || {};
          if (targetUserId) {
            broadcastToUser(String(targetUserId), 'call:signal', {
              callId,
              fromUserId: ws.userId,
              signal,
            });
          }
          return;
        }

        // Call response from recipient via WebSocket
        if (event === 'call:respond') {
          const { callId, action, answerSdp } = payload || {};
          if (callId && activeCalls.has(callId)) {
            const call = activeCalls.get(callId);
            if (String(call.recipientId) === String(ws.userId)) {
              if (action === 'answer') {
                call.status = 'connected';
                call.connectedAt = new Date().toISOString();
                if (answerSdp) call.answerSdp = answerSdp;
                broadcastToUser(call.callerId, 'call:answered', call);
                broadcastToUser(call.recipientId, 'call:connected', call);
              } else if (action === 'decline') {
                terminateCallSession(call, 'declined', ws.userId);
              }
            }
          }
          return;
        }

        // End call initiated by client
        if (event === 'call:end') {
          const { callId } = payload || {};
          if (callId && activeCalls.has(callId)) {
            const call = activeCalls.get(callId);
            const finalStatus = call.status === 'connected' ? 'completed' : 'missed';
            terminateCallSession(call, finalStatus, ws.userId);
          }
          return;
        }
      } catch (err) {
        console.warn('[WebSocket Message Handling Error]', err);
      }
    });

    ws.on('close', () => {
      if (ws.userId && userSockets.has(ws.userId)) {
        const userSet = userSockets.get(ws.userId);
        userSet.delete(ws);
        if (userSet.size === 0) {
          userSockets.delete(ws.userId);
        }
      }
    });

    ws.on('error', (err) => {
      console.warn('[WebSocket Client Error]', err.message);
    });
  });

  // Keep-alive ping interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        return ws.terminate();
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        ws.terminate();
      }
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

/**
 * Helper to send formatted JSON event to a single WebSocket client
 */
export function sendEvent(ws, event, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({ event, payload, timestamp: new Date().toISOString() }));
    } catch (e) {
      console.warn('[sendEvent Error]', e.message);
    }
  }
}

/**
 * Broadcast event to all active sockets of a specific user
 */
export function broadcastToUser(userId, event, payload) {
  const sockets = userSockets.get(String(userId));
  if (sockets && sockets.size > 0) {
    sockets.forEach((ws) => {
      sendEvent(ws, event, payload);
    });
    return true;
  }
  return false;
}

/**
 * Broadcast new chat message to recipient and sender
 */
export function broadcastChatMessage(messageDoc) {
  const m = messageDoc.toObject ? messageDoc.toObject() : messageDoc;
  const senderId = String(m.senderId);
  const recipientId = String(m.recipientId);

  // Broadcast to recipient
  broadcastToUser(recipientId, 'message:new', m);
  // Broadcast to sender (for multi-device / multi-tab sync)
  broadcastToUser(senderId, 'message:sent', m);
}

/**
 * Active calls management
 */
export function getActiveCalls() {
  return activeCalls;
}

export function createCallSession(callData) {
  activeCalls.set(callData.callId, callData);

  // Broadcast to recipient
  broadcastToUser(callData.recipientId, 'call:incoming', callData);
  // Broadcast confirmation to caller
  broadcastToUser(callData.callerId, 'call:ringing', callData);

  return callData;
}

export async function terminateCallSession(call, finalStatus = 'ended', endedByUserId = null) {
  call.status = finalStatus;
  const duration = call.connectedAt
    ? Math.max(0, Math.round((Date.now() - new Date(call.connectedAt).getTime()) / 1000))
    : 0;
  call.duration = duration;

  // Notify both participants
  broadcastToUser(call.callerId, 'call:ended', { ...call, finalStatus, endedByUserId });
  broadcastToUser(call.recipientId, 'call:ended', { ...call, finalStatus, endedByUserId });

  // Record call message into database if tenant DB available
  try {
    const tenantDb = await dbManager.getTenantDB(call.databaseName);
    if (tenantDb && tenantDb.Message) {
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      const durationStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

      let logText = '';
      if (finalStatus === 'declined') {
        logText = `📞 Call declined`;
      } else if (finalStatus === 'missed') {
        logText = `📞 Missed call`;
      } else {
        logText = `${call.type === 'video' ? '📹 Video Call' : '📞 Audio Call'} ended • ${durationStr}`;
      }

      const convId = [String(call.callerId), String(call.recipientId)].sort().join('_');
      await tenantDb.Message.create({
        conversationId: convId,
        senderId: call.callerId,
        senderName: call.callerName,
        senderRole: call.callerRole,
        recipientId: call.recipientId,
        recipientName: call.recipientName,
        recipientRole: call.recipientRole,
        text: logText,
        content: logText,
        message: logText,
        callData: {
          type: call.type,
          duration,
          status: finalStatus,
          timestamp: new Date().toISOString(),
        },
        read: false,
        createdAt: new Date(),
      });
    }
  } catch (err) {
    console.warn('[Failed to log call history to database]', err.message);
  }

  activeCalls.delete(call.callId);
  return call;
}
