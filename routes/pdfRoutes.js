import express from'express';
const router = express.Router();
import { generatePdf } from '#controllers/pdfController.js';

router.post('/generate-pdf', generatePdf);

export default router;
