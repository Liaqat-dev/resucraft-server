import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
    createResume,
    getAllResumes,
    getResume,
    updateResume,
    deleteResume,
} from '../controllers/resumeController.js';

const router = express.Router();

router.use(protect);

router.get('/', getAllResumes);
router.post('/', createResume);
router.get('/:id', getResume);
router.put('/:id', updateResume);
router.delete('/:id', deleteResume);

export default router;
