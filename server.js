import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import https from 'node:https';
import http from 'node:http';

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import cors from 'cors';


import authRoutes from '#routes/authRoutes.js';
import educationRoutes from "#routes/educationRoutes.js";
import experienceRoutes from "#routes/experienceRoutes.js";
import pdfRoutes from "#routes/pdfRoutes.js";
import templateRoutes from "#routes/templateRoutes.js";
import {globalErrorHandler} from "#middlewares/errorHandler.js";
import connectDB from '#utils/db.js';
import skillRoutes from "#routes/skillRoutes.js";

import personalInfoRoutes from "#routes/personalInfoRoutes.js";
import projectRoutes from "#routes/projectRoutes.js";
import certificateRoutes from "#routes/certificateRoutes.js";
import aiRoutes from "#routes/aiRoutes.js";
import { handleInterviewSocket } from '#controllers/interviewController.js';

dotenv.config();
connectDB().catch(err => {
    console.error('DB connection failed:', err.message);
    process.exit(1);
});



const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
    process.env.FRONTEND_URL,          // web client (e.g. http://localhost:5173)
    'http://localhost:8081',            // Expo web / Metro bundler
    'http://localhost:19006',           // Expo web (older)
    ...(process.env.MOBILE_ORIGINS     // comma-separated extra origins from .env
        ? process.env.MOBILE_ORIGINS.split(',').map(o => o.trim())
        : []),
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // No Origin header = React Native native runtime — allow it
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        // In development, also allow any localhost/LAN origin automatically
        if (process.env.NODE_ENV === 'development' &&
            (origin.startsWith('http://localhost') || origin.startsWith('http://192.168.') || origin.startsWith('http://10.'))) {
            return callback(null, true);
        }
        callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
}));

// Health check / keep-alive
app.get('/api/ping', (req, res) => res.sendStatus(200));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/templates', templateRoutes);
app.use("/api/education", educationRoutes);
app.use("/api/experience",experienceRoutes);
app.use("/api/skills", skillRoutes);

app.use("/api/personal-info", personalInfoRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/ai", aiRoutes);

const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);

// ── WebSocket server for live interview ───────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });
wss.on('connection', (ws, req) => handleInterviewSocket(ws, req));

httpServer.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws/interview') {
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else {
        socket.destroy();
    }
});

app.all('{*splat}', (req, res) => {
    res.status(404).send('No URL found at server');
})
app.use(globalErrorHandler);
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);

    // Keep-alive ping for Render free tier (spins down after 15 min of inactivity)
    if (process.env.RENDER_EXTERNAL_URL) {
        const pingUrl = new URL('/api/ping', process.env.RENDER_EXTERNAL_URL);
        const client = pingUrl.protocol === 'https:' ? https : http;
        setInterval(() => {
            client.get(pingUrl.toString(), (res) => {
                console.log(`[keep-alive] ping → ${res.statusCode}`);
            }).on('error', (err) => {
                console.warn(`[keep-alive] ping failed: ${err.message}`);
            });
        }, 14 * 60 * 1000); // every 14 minutes
        console.log(`[keep-alive] self-ping active → ${pingUrl}`);
    }
});
