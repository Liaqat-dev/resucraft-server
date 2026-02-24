import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
    getAllCertificates,
    createCertificate,
    updateCertificate,
    deleteCertificate,
} from "../controllers/certificateController.js";

const router = express.Router();

router.use(protect);

router.get("/", getAllCertificates);
router.post("/", createCertificate);
router.put("/:id", updateCertificate);
router.delete("/:id", deleteCertificate);

export default router;