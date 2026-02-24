import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
    getAllProjects,
    createProject,
    updateProject,
    deleteProject,
} from "../controllers/projectController.js";

const router = express.Router();

router.use(protect);

router.get("/", getAllProjects);
router.post("/", createProject);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);

export default router;