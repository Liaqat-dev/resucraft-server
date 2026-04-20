import { scoreResume } from '#services/atsService.js';

/**
 * POST /api/ats-score
 * Body: { resumeData: { elements, sections, ... }, jobDescription?: string }
 */
export async function getAtsScore(req, res, next) {
    try {
        const { resumeData, jobDescription = '' } = req.body;

        if (!resumeData || typeof resumeData !== 'object') {
            return res.status(400).json({ message: 'resumeData is required and must be an object.' });
        }

        const result = scoreResume(resumeData, jobDescription);
        return res.status(200).json(result);
    } catch (err) {
        next(err);
    }
}