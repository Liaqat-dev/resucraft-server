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

// router.use(protect);

router.get('/',protect, getAllResumes);
router.post('/',protect, createResume);
router.get('/:id', getResume);
router.put('/:id',protect, updateResume);
router.delete('/:id',protect, deleteResume);

export default router;
