import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
    getAllEducation,
    createEducation,
    updateEducation,
    deleteEducation
} from "../controllers/educationController.js";

const router = express.Router();


router.use(protect);

router.get("/", getAllEducation);
router.post("/", createEducation);
router.put("/:id", updateEducation);
router.delete("/:id", deleteEducation);

export default router;
