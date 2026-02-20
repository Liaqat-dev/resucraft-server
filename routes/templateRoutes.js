import express from'express';
import {
    saveTemplate,
    getTemplate,
    listTemplates,
    updateTemplate,
    deleteTemplate
} from '#controllers/templateController.js';
const router = express.Router();
router.post('/save', saveTemplate);
router.get('/', listTemplates);
router.get('/:id', getTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
