import express from "express";
import { getPersonalInfo, updatePersonalInfo, uploadProfilePic } from "../controllers/personalInfoController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Require authentication
router.use(protect);

router.get("/", getPersonalInfo);
router.put("/", uploadProfilePic.single("profilePic"), updatePersonalInfo);

export default router;