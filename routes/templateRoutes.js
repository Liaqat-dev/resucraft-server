import express from 'express';
import {
    saveTemplate,
    getTemplate,
    listTemplates,
    listAllTemplates,
    updateTemplate,
    deleteTemplate
} from '#controllers/templateController.js';
import { protect, requireVerified } from '#middlewares/authMiddleware.js';

const router = express.Router();

router.get('/all', listAllTemplates);
router.get('/:id', getTemplate);
router.use(protect, requireVerified);

router.post('/save', saveTemplate);
router.get('/', listTemplates);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
