import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { generateResume } from '../controllers/aiController.js';

const router = express.Router();

router.post('/generate-resume', protect, generateResume);

export default router;
