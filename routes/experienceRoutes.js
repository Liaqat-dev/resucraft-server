
import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
    createExperience,
    getAllExperience,
    updateExperience,
    deleteExperience
} from "../controllers/experienceController.js";

const router = express.Router();

router.use(protect);

router.get("/", getAllExperience);
router.post("/", createExperience);
router.put("/:id", updateExperience);
router.delete("/:id", deleteExperience);

export default router;
