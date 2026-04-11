import PersonalInfo from '#models/personalInfo.js';
import Education from '#models/education.js';
import Experience from '#models/experience.js';
import Skill from '#models/skills.js';
import Project from '#models/project.js';
import Certificate from '#models/certificate.js';
import Template from '#models/Template.js';
import { generateTailoredResume } from '#services/aiResumeService.js';
import { AppError } from '#middlewares/errorHandler.js';
export const generateResume = async (req, res, next) => {
    try {
        const { templateId, jobDescription } = req.body;

        if (!templateId || !jobDescription) {
            throw new AppError('templateId and jobDescription are required', 400);
        }
        if (String(jobDescription).trim().length < 20) {
            throw new AppError('Job description must be at least 20 characters', 400);
        }

        const userId = req.user._id;

        const [template, personalInfo, education, experience, skills, projects, certificates] =
            await Promise.all([
                Template.findById(templateId),
                PersonalInfo.findOne({ userId }),
                Education.find({ user: userId }),
                Experience.find({ user: userId }),
                Skill.find({ user: userId }),
                Project.find({ user: userId }),
                Certificate.find({ user: userId }),
            ]);

        if (!template) {
            throw new AppError('Template not found', 404);
        }

        const profile = { personalInfo, education, experience, skills, projects, certificates };
        const filledData = await generateTailoredResume(template.data, jobDescription, profile);

        res.json({
            success: true,
            filledTemplate: {
                _id: template._id,
                name: template.name,
                data: filledData,
            },
        });
    } catch (error) {
        next(error);
    }
};
