import Skill from "#models/skills.js";
import { AppError } from "#middlewares/errorHandler.js";

export const createSkills = async (req, res, next) => {
    try {
        const { skills } = req.body;

        if (!skills || !Array.isArray(skills)) {
            throw new AppError("Skills array required", 400);
        }

        const formatted = skills.map((skill) => ({
            user: req.user._id,
            name: skill.name,
            category: skill.category,
        }));

        const created = await Skill.insertMany(formatted);

        res.status(201).json({
            status: "success",
            skills: created,
        });
    } catch (err) {
        next(err);
    }
};

export const getAllSkills = async (req, res, next) => {
    try {
        const skills = await Skill.find({ user: req.user._id });
        res.status(200).json({ status: "success", skills });
    } catch (err) {
        next(err);
    }
};

export const deleteSkill = async (req, res, next) => {
    try {
        await Skill.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id,
        });

        res.status(200).json({ status: "success" });
    } catch (err) {
        next(err);
    }
};