
import Experience from '#models/experience.js';
import { AppError } from '#middlewares/errorHandler.js';


export const createExperience = async (req, res, next) => {
    try {
        const { company, role, startDate, endDate, currentlyWorking, description } = req.body;

        if (!company || !role || !startDate) {
            throw new AppError("Company, role, and startDate are required", 400);
        }

        const experience = await Experience.create({
            user: req.user._id,
            company,
            role,
            startDate,
            endDate: currentlyWorking ? undefined : endDate,
            currentlyWorking,
            description
        });

        res.status(201).json({ status: "success", experience });
    } catch (error) {
        next(error);
    }
};


export const getAllExperience = async (req, res, next) => {
    try {
        const experiences = await Experience.find({ user: req.user._id });
        res.status(200).json({ status: "success", experiences });
    } catch (error) {
        next(error);
    }
};


export const updateExperience = async (req, res, next) => {
    try {
        const { company, role, startDate, endDate, currentlyWorking, description } = req.body;

        const exp = await Experience.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            {
                company,
                role,
                startDate,
                endDate: currentlyWorking ? undefined : endDate,
                currentlyWorking,
                description
            },
            { new: true, runValidators: true }
        );

        if (!exp) throw new AppError("Experience not found", 404);

        res.status(200).json({ status: "success", experience: exp });
    } catch (error) {
        next(error);
    }
};


export const deleteExperience = async (req, res, next) => {
    try {
        const exp = await Experience.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        if (!exp) throw new AppError("Experience not found", 404);
        res.status(200).json({ status: "success" });
    } catch (error) {
        next(error);
    }
};
