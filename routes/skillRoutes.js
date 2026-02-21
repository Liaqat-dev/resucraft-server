import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
    createSkills,
    getAllSkills,
    deleteSkill,
} from "../controllers/skillController.js";

const router = express.Router();

router.use(protect);

router.get("/", getAllSkills);
router.post("/", createSkills);
router.delete("/:id", deleteSkill);

export default router;