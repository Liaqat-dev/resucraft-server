import PersonalInfo from "../models/personalInfo.js";
import multer from "multer";

// Use memory storage — file buffer available at req.file.buffer
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"), false);
};

export const uploadProfilePic = multer({ storage, fileFilter });

// Upload image buffer to imgbb; returns { url, deleteUrl }
const uploadToImgbb = async (buffer, filename) => {
    const base64 = buffer.toString("base64");

    const form = new FormData();
    form.append("image", base64);
    form.append("name", filename);

    const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY_V1}`,
        { method: "POST", body: form }
    );

    const data = await response.json();

    if (!data.success) throw new Error(`imgbb upload failed: ${JSON.stringify(data)}`);

    return {
        url: data.data.display_url,
        deleteUrl: data.data.delete_url,
    };
};

// Delete image from imgbb using the stored delete URL
const deleteFromImgbb = async (deleteUrl) => {
    try {
        await fetch(deleteUrl);
    } catch (err) {
        console.error("imgbb delete failed:", err.message);
    }
};

export const getPersonalInfo = async (req, res) => {
    try {
        const userId = req.user._id;
        let personalInfo = await PersonalInfo.findOne({ userId });

        if (!personalInfo) {
            personalInfo = new PersonalInfo({ userId });
            await personalInfo.save();
        }

        res.json({ success: true, personalInfo });
    } catch (err) {
        console.error("Get personal info error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

export const updatePersonalInfo = async (req, res) => {
    try {
        const userId = req.user._id;

        let personalInfo = await PersonalInfo.findOne({ userId });
        if (!personalInfo) personalInfo = new PersonalInfo({ userId });

        const { name, dob, bio, phone, github, linkedin } = req.body;

        personalInfo.name = name;
        personalInfo.dob = dob;
        personalInfo.bio = bio;
        personalInfo.phone = phone;
        personalInfo.github = github;
        personalInfo.linkedin = linkedin;

        if (req.file) {
            // Delete previous profile pic from imgbb before uploading the new one
            if (personalInfo.profilePicDeleteUrl) {
                await deleteFromImgbb(personalInfo.profilePicDeleteUrl);
            }

            const { url, deleteUrl } = await uploadToImgbb(req.file.buffer, req.file.originalname);
            personalInfo.profilePic = url;
            personalInfo.profilePicDeleteUrl = deleteUrl;
        }

        await personalInfo.save();

        res.json({ success: true, personalInfo });
    } catch (err) {
        console.error("Update personal info error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};
