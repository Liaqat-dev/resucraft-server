import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    submitContact,
    getContactMessages,
    getContactMessage,
    updateContactStatus,
    deleteContactMessage,
    getContactStats,
    replyToContact,
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

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/stats', getContactStats);
router.get('/', getContactMessages);
router.get('/:id', getContactMessage);
router.patch('/:id/status', updateContactStatus);
router.post('/:id/reply', replyToContact);
router.delete('/:id', deleteContactMessage);

export default router;
