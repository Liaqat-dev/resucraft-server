import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);



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

dotenv.config();
connectDB();



const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allowed browser origins (web client + Expo web dev server).
// React Native native runtime does NOT enforce CORS, so mobile requests
// with no Origin header are passed through unconditionally.
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
app.all('{*splat}', (req, res) => {
    res.status(404).send('No URL found at server');
})
app.use(globalErrorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});
