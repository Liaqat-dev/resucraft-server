import ContactMessage from '#models/contactMessage.js';
import { sendContactNotificationEmail, sendContactReplyEmail } from '#services/emailService.js';
import catchAsync from '#utils/catchAsync.js';
import { AppError } from '#middlewares/errorHandler.js';

// ── Public ────────────────────────────────────────────────────────────────────

/**
 * POST /api/contact/send
 * Save message to DB and notify admin by email.
 */
export const submitContact = catchAsync(async (req, res) => {
    const { name, email, topic, message } = req.body;

    if (!name || !email || !topic || !message) {
        throw new AppError('All fields are required.', 400);
    }

    const contact = await ContactMessage.create({ name, email, topic, message });

    // Fire-and-forget email — DB record is the source of truth
    sendContactNotificationEmail({ name, email, topic, message });

    res.status(201).json({
        message: 'Your message has been received. We\'ll get back to you within 24 hours.',
        id: contact._id,
    });
});

// ── Admin ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/contact/stats
 * Quick unread / total counts for admin dashboard widget.
 */
export const getContactStats = catchAsync(async (req, res) => {
    const [total, unread, replied, archived] = await Promise.all([
        ContactMessage.countDocuments(),
        ContactMessage.countDocuments({ status: 'unread' }),
        ContactMessage.countDocuments({ status: 'replied' }),
        ContactMessage.countDocuments({ status: 'archived' }),
    ]);
    res.json({ total, unread, replied, archived });
});

/**
 * GET /api/contact
 * List all messages. Supports ?status=unread&page=1&limit=20
 */
export const getContactMessages = catchAsync(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = status ? { status } : {};
    const skip = (Number(page) - 1) * Number(limit);

    const [messages, total] = await Promise.all([
        ContactMessage.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        ContactMessage.countDocuments(filter),
    ]);

    res.json({
        messages,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
    });
});

/**
 * GET /api/contact/:id
 * Single message + mark as read automatically.
 */
export const getContactMessage = catchAsync(async (req, res) => {
    const contact = await ContactMessage.findById(req.params.id);
    if (!contact) throw new AppError('Message not found.', 404);

    if (contact.status === 'unread') {
        contact.status = 'read';
        await contact.save();
    }

    res.json(contact);
});

/**
 * PATCH /api/contact/:id/status
 * Update status: unread | read | replied | archived
 */
export const updateContactStatus = catchAsync(async (req, res) => {
    const { status } = req.body;
    const allowed = ['unread', 'read', 'replied', 'archived'];
    if (!allowed.includes(status)) {
        throw new AppError(`Status must be one of: ${allowed.join(', ')}.`, 400);
    }

    const contact = await ContactMessage.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true, runValidators: true }
    );
    if (!contact) throw new AppError('Message not found.', 404);

    res.json(contact);
});

/**
 * POST /api/contact/:id/reply
 * Send a reply email to the user and mark the message as replied.
 */
export const replyToContact = catchAsync(async (req, res) => {
    const { replyText } = req.body;
    if (!replyText || !replyText.trim()) {
        throw new AppError('Reply text is required.', 400);
    }

    const contact = await ContactMessage.findById(req.params.id);
    if (!contact) throw new AppError('Message not found.', 404);

    await sendContactReplyEmail({
        toName: contact.name,
        toEmail: contact.email,
        originalMessage: contact.message,
        replyText: replyText.trim(),
        topic: contact.topic,
    });

    contact.status = 'replied';
    await contact.save();

    res.json({ message: 'Reply sent successfully.', contact });
});

/**
 * DELETE /api/contact/:id
 */
export const deleteContactMessage = catchAsync(async (req, res) => {
    const contact = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!contact) throw new AppError('Message not found.', 404);
    res.json({ message: 'Message deleted.' });
});
