/**
 * Standalone Express + Socket.IO Server
 *
 * Runs independently from Next.js on PORT (default 3001).
 * Handles:
 *  - Socket.IO real-time results broadcasting
 *  - Express rate limiting middleware
 *  - Health check endpoint
 *
 * Usage:
 *   Development: npx tsx server.ts
 *   Production:  node server.js (after compiling)
 */

// @ts-ignore - Workspace diagnostics may fail to resolve DefinitelyTyped modules even when installed.
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
// @ts-ignore - Workspace diagnostics may fail to resolve DefinitelyTyped modules even when installed.
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

// Load env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const PORT = Number(process.env.PORT || 3001);
const CORS_ORIGIN = process.env.SOCKET_CORS_ORIGIN || "http://localhost:3000";

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);

// CORS — allow Next.js frontend
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(express.json());

// ─── Rate Limiters ────────────────────────────────────────────────────────────

export const otpRequestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    ok: false,
    error: "Too many OTP requests. Try again in a minute.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { ok: false, error: "Too many verification attempts." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { ok: false, error: "Too many vote submissions." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────

const io = new SocketIOServer(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Results namespace
const resultsNamespace = io.of("/results");

resultsNamespace.on("connection", (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Heartbeat — every 30 seconds
setInterval(() => {
  resultsNamespace.emit("heartbeat", { timestamp: Date.now() });
}, 30000);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (_req: unknown, res: { json: (body: unknown) => void }) => {
  res.json({
    ok: true,
    server: "ELP Voting API Server",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Broadcast updated results to all connected clients.
 * Called after a vote is cast (from API routes via HTTP).
 * RESTRICTED to localhost for security.
 */
app.post(
  "/internal/broadcast-results",
  (
    req: { socket: { remoteAddress?: string | null }; body: unknown },
    res: {
      status: (code: number) => { json: (body: unknown) => unknown };
      json: (body: unknown) => unknown;
    },
  ) => {
    const remoteAddress = req.socket.remoteAddress;
    const isLocal =
      remoteAddress === "::1" ||
      remoteAddress === "127.0.0.1" ||
      remoteAddress === "::ffff:127.0.0.1";

    if (!isLocal && process.env.NODE_ENV === "production") {
      console.warn(
        `[Socket.IO] Unauthorized broadcast attempt from ${remoteAddress}`,
      );
      return res.status(403).json({ error: "Unauthorized" });
    }

    const payload = req.body;
    resultsNamespace.emit("vote_cast", payload);
    console.log("[Socket.IO] Broadcasted vote_cast event");
    res.json({ ok: true });
  },
);

// ─── Start Server ─────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n🗳️  ELP Voting Server running on port ${PORT}`);
  console.log(`   Socket.IO namespace: /results`);
  console.log(`   CORS origin: ${CORS_ORIGIN}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});

export { io, resultsNamespace };
