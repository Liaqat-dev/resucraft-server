import Project from '#models/project.js';
import { AppError } from '#middlewares/errorHandler.js';

export const createProject = async (req, res, next) => {
    try {
        const { title, description, liveUrl, repoUrl, startDate, endDate, technologies, status } = req.body;

        if (!title) {
            throw new AppError("Project title is required", 400);
        }

        const project = await Project.create({
            user: req.user._id,
            title,
            description,
            liveUrl,
            repoUrl,
            startDate,
            endDate,
            technologies: Array.isArray(technologies) ? technologies : [],
            status: status || "completed",
        });

        res.status(201).json({ status: "success", project });
    } catch (error) {
        next(error);
    }
};

export const getAllProjects = async (req, res, next) => {
    try {
        const projects = await Project.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json({ status: "success", projects });
    } catch (error) {
        next(error);
    }
};

export const updateProject = async (req, res, next) => {
    try {
        const { title, description, liveUrl, repoUrl, startDate, endDate, technologies, status } = req.body;

        const project = await Project.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { title, description, liveUrl, repoUrl, startDate, endDate, technologies, status },
            { new: true, runValidators: true }
        );

        if (!project) throw new AppError("Project not found", 404);

        res.status(200).json({ status: "success", project });
    } catch (error) {
        next(error);
    }
};

export const deleteProject = async (req, res, next) => {
    try {
        const project = await Project.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!project) throw new AppError("Project not found", 404);

        res.status(200).json({ status: "success" });
    } catch (error) {
        next(error);
    }
};