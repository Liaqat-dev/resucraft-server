import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    submitContact,
    getContactMessages,
    getContactMessage,
    updateContactStatus,
    deleteContactMessage,
    getContactStats,
} from '#controllers/contactController.js';

const router = express.Router();

const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: { message: 'Too many messages sent. Please wait before trying again.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/send', contactLimiter, submitContact);

// ── Admin (protect middleware will be applied here when admin panel is ready) ─
router.get('/stats', getContactStats);
router.get('/', getContactMessages);
router.get('/:id', getContactMessage);
router.patch('/:id/status', updateContactStatus);
router.delete('/:id', deleteContactMessage);

export default router;
