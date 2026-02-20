import EducationModel from '#models/education.js';
import { AppError } from '#middlewares/errorHandler.js';


export const createEducation = async (req, res, next) => {
    try {
        const { school, degree, fieldOfStudy, startDate, endDate, grade, description } = req.body;

        if (!school || !degree || !startDate) {
            throw new AppError("School, degree, and startDate are required", 400);
        }

        const education = await EducationModel.create({
            user: req.user._id,
            school,
            degree,
            fieldOfStudy,
            startDate,
            endDate,
            grade,
            description
        });

        res.status(201).json({ status: "success", education });
    } catch (error) {
        next(error);
    }
};


export const getAllEducation = async (req, res, next) => {
    try {
        const educations = await EducationModel.find({ user: req.user._id });
        res.status(200).json({ status: "success", educations });
    } catch (error) {
        next(error);
    }
};


export const updateEducation = async (req, res, next) => {
    try {
        const { school, degree, fieldOfStudy, startDate, endDate, grade, description } = req.body;

        const edu = await EducationModel.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { school, degree, fieldOfStudy, startDate, endDate, grade, description },
            { new: true, runValidators: true }
        );

        if (!edu) throw new AppError("Education not found", 404);

        res.status(200).json({ status: "success", education: edu });
    } catch (error) {
        next(error);
    }
};


export const deleteEducation = async (req, res, next) => {
    try {
        const edu = await EducationModel.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id
        });

        if (!edu) throw new AppError("Education not found", 404);

        res.status(200).json({ status: "success" });
    } catch (error) {
        next(error);
    }
};
