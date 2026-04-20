import express from 'express';
import { protect } from '#middlewares/authMiddleware.js';
import { getAtsScore } from '#controllers/atsController.js';

const router = express.Router();

router.use(protect);

router.post('/', getAtsScore);

export default router;
