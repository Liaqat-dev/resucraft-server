import express from "express";
import {getPersonalInfo, updatePersonalInfo,} from "../controllers/personalInfoController.js";
import {protect} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/",protect, getPersonalInfo);
router.put("/",protect, updatePersonalInfo);

export default router;