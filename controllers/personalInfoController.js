import PersonalInfo from "../models/personalInfo.js";
import multer from "multer";
import path from "path";
import fs from "fs";


const uploadDir = "uploads/profilePics";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });


const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${file.fieldname}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"), false);
};

export const uploadProfilePic = multer({ storage, fileFilter });

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

        if (req.file) personalInfo.profilePic = req.file.filename;

        await personalInfo.save();

        res.json({ success: true, personalInfo });
    } catch (err) {
        console.error("Update personal info error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};