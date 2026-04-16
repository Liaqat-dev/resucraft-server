import mongoose from "mongoose";
import Template from '#models/Template.js';

const checkDb = (res) => {
    if (!mongoose.connection.readyState) {
        res.status(503).json({
            error: 'Database not available',
            message: 'Please save template locally using browser storage'
        });
        return false;
    }
    return true;
};

export const saveTemplate = async (req, res) => {
    try {
        if (!checkDb(res)) return;

        const template = new Template({ ...req.body, userId: req.user._id });
        template.updatedAt = new Date();

        await template.save();

        console.log(`Template saved to MongoDB: ${template._id}`);

        res.json({
            success: true,
            id: template._id,
            message: 'Template saved successfully'
        });
    } catch (error) {
        console.error('Save Template Error:', error);
        res.status(500).json({
            error: 'Failed to save template',
            message: error.message
        });
    }
};

export const getTemplate = async (req, res) => {
    try {
        if (!checkDb(res)) return;

        const template = await Template.findById(req.params.id);

        if (!template) {
            return res.status(404).json({
                error: 'Template not found',
                message: `Template with ID ${req.params.id} does not exist`
            });
        }

        // if (template.userId.toString() !== req.user._id.toString()) {
        //     return res.status(403).json({ error: 'Access denied' });
        // }

        console.log(`Template loaded from MongoDB: ${req.params.id}`);

        res.json({
            id: template._id,
            name: template.name,
            category: template.category,
            visibility: template.visibility,
            status: template.status,
            data: template.data,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt
        });
    } catch (error) {
        console.error('Load Template Error:', error);
        res.status(500).json({
            error: 'Failed to load template',
            message: error.message
        });
    }
};

export const listTemplates = async (req, res) => {
    try {
        if (!mongoose.connection.readyState) {
            return res.status(503).json({
                error: 'Database not available',
                templates: []
            });
        }

        const templates = await Template.find({ userId: req.user._id })
            .sort({ updatedAt: -1 })
            .limit(50);

        res.json({ success: true, templates });
    } catch (error) {
        console.error('List Templates Error:', error);
        res.status(500).json({
            error: 'Failed to list templates',
            message: error.message
        });
    }
};

export const listAllTemplates = async (req, res) => {
    try {
        if (!mongoose.connection.readyState) {
            return res.status(503).json({
                error: 'Database not available',
                templates: []
            });
        }

        const templates = await Template.find({ visibility: 'public' })
            .sort({ updatedAt: -1 })
            .limit(100);

        res.json({ success: true, templates });
    } catch (error) {
        console.error('List All Templates Error:', error);
        res.status(500).json({
            error: 'Failed to list templates',
            message: error.message
        });
    }
};

export const updateTemplate = async (req, res) => {
    try {
        if (!checkDb(res)) return;

        const template = await Template.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { ...req.body, updatedAt: new Date() },
            { new: true }
        );

        if (!template) {
            return res.status(404).json({
                error: 'Template not found or access denied',
                message: `Template with ID ${req.params.id} does not exist or you do not own it`
            });
        }

        console.log(`Template updated: ${req.params.id}`);

        res.json({
            success: true,
            id: template._id,
            message: 'Template updated successfully'
        });
    } catch (error) {
        console.error('Update Template Error:', error);
        res.status(500).json({
            error: 'Failed to update template',
            message: error.message
        });
    }
};

export const publishTemplate = async (req, res) => {
    try {
        if (!checkDb(res)) return;

        const existing = await Template.findOne(
            { _id: req.params.id, userId: req.user._id },
            { status: 1, visibility: 1 }
        );

        if (!existing) {
            return res.status(404).json({ error: 'Template not found or access denied' });
        }

        if (existing.status === 'published') {
            return res.status(400).json({ error: 'Template is already published' });
        }

        const template = await Template.findByIdAndUpdate(
            req.params.id,
            { status: 'pending', visibility: 'private', updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        console.log(`Template submitted for review: ${req.params.id}`);

        res.json({
            success: true,
            id: template._id,
            status: template.status,
            message: 'Template submitted for review'
        });
    } catch (error) {
        console.error('Publish Template Error:', error);
        res.status(500).json({ error: 'Failed to publish template', message: error.message });
    }
};

export const deleteTemplate = async (req, res) => {
    try {
        if (!checkDb(res)) return;

        const deleted = await Template.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

        if (!deleted) {
            return res.status(404).json({
                error: 'Template not found or access denied',
                message: `Template with ID ${req.params.id} does not exist or you do not own it`
            });
        }

        console.log(`Template deleted: ${req.params.id}`);

        res.json({
            success: true,
            message: 'Template deleted successfully'
        });
    } catch (error) {
        console.error('Delete Template Error:', error);
        res.status(500).json({
            error: 'Failed to delete template',
            message: error.message
        });
    }
};
