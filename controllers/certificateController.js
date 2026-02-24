import Certificate from '#models/certificate.js';
import { AppError } from '#middlewares/errorHandler.js';

export const createCertificate = async (req, res, next) => {
    try {
        const { name, issuer, issueDate, expiryDate, credentialId, credentialUrl, description } = req.body;

        if (!name || !issuer || !issueDate) {
            throw new AppError("Name, issuer, and issue date are required", 400);
        }

        const certificate = await Certificate.create({
            user: req.user._id,
            name,
            issuer,
            issueDate,
            expiryDate,
            credentialId,
            credentialUrl,
            description,
        });

        res.status(201).json({ status: "success", certificate });
    } catch (error) {
        next(error);
    }
};

export const getAllCertificates = async (req, res, next) => {
    try {
        const certificates = await Certificate.find({ user: req.user._id }).sort({ issueDate: -1 });
        res.status(200).json({ status: "success", certificates });
    } catch (error) {
        next(error);
    }
};

export const updateCertificate = async (req, res, next) => {
    try {
        const { name, issuer, issueDate, expiryDate, credentialId, credentialUrl, description } = req.body;

        const certificate = await Certificate.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { name, issuer, issueDate, expiryDate, credentialId, credentialUrl, description },
            { new: true, runValidators: true }
        );

        if (!certificate) throw new AppError("Certificate not found", 404);

        res.status(200).json({ status: "success", certificate });
    } catch (error) {
        next(error);
    }
};

export const deleteCertificate = async (req, res, next) => {
    try {
        const certificate = await Certificate.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!certificate) throw new AppError("Certificate not found", 404);

        res.status(200).json({ status: "success" });
    } catch (error) {
        next(error);
    }
};