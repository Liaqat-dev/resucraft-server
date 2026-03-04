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

dotenv.config();
connectDB();



const app = express();
const checkAndFixIndexes = async () => {
    console.log('\n🔍 Checking Session indexes...');

    try {
        const Session = mongoose.connection.collection('sessions');
        const indexes = await Session.indexes();

        console.log('📋 Current indexes:', JSON.stringify(indexes, null, 2));

        // Look for TTL indexes
        let foundTTL = false;
        for (const index of indexes) {
            if (index.expireAfterSeconds !== undefined) {
                console.error('⚠️⚠️⚠️ TTL INDEX FOUND!');
                console.error('   Index name:', index.name);
                console.error('   Expire after:', index.expireAfterSeconds, 'seconds');
                console.error('   Dropping it now...');

                await Session.dropIndex(index.name);
                console.log('✅ TTL index dropped:', index.name);
                foundTTL = true;
            }
        }

        if (!foundTTL) {
            console.log('✅ No TTL indexes found - good!');
        }

    } catch (error) {
        console.error('❌ Error checking indexes:', error.message);
    }
};

await checkAndFixIndexes();
// Middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());
// app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));


app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

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
app.all('{*splat}', (req, res) => {
    res.status(404).send('No URL found at server');
})
app.use(globalErrorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});
