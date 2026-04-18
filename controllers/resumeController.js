import Resume from '#models/Resume.js';
import { AppError } from '#middlewares/errorHandler.js';

export const createResume = async (req, res, next) => {
    try {
        const { name, category, data } = req.body;

        if (!name?.trim()) {
            throw new AppError('Resume name is required', 400);
        }

        const resume = await Resume.create({
            userId: req.user._id,
            name: name.trim(),
            category,
            data,
        });

        res.status(201).json({ status: 'success', resume });
    } catch (error) {
        next(error);
    }
};

export const getAllResumes = async (req, res, next) => {
    try {
        const resumes = await Resume.find({ userId: req.user._id }).sort({ updatedAt: -1 });
        res.status(200).json({ status: 'success', resumes });
    } catch (error) {
        next(error);
    }
};

export const getResume = async (req, res, next) => {
    try {
        const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });

        if (!resume) throw new AppError('Resume not found', 404);

        res.status(200).json({ status: 'success', resume });
    } catch (error) {
        next(error);
    }
};

export const updateResume = async (req, res, next) => {
    try {
        const { name, category, data } = req.body;

        const resume = await Resume.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { name, category, data, updatedAt: Date.now() },
            { new: true, runValidators: true },
        );

        if (!resume) throw new AppError('Resume not found', 404);

        res.status(200).json({ status: 'success', resume });
    } catch (error) {
        next(error);
    }
};

export const deleteResume = async (req, res, next) => {
    try {
        const resume = await Resume.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

        if (!resume) throw new AppError('Resume not found', 404);

        res.status(200).json({ status: 'success' });
    } catch (error) {
        next(error);
    }
};
