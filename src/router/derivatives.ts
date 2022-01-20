import express from "express";

import { auth } from "../middleware/auth";

import {
  addDerivatives,
  getDerivatives,
  downloadFile,
  getDerivative
} from "../controller/derivatives";

const router = express.Router();

router.post("/", auth, addDerivatives);

router.get("/", auth, getDerivatives);

router.get("/single", auth, getDerivative);

router.get("/download/:fileId", auth, downloadFile);

export default router;
