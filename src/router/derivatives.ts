import express from "express";

import {
  addDerivatives,
  getDerivatives,
  getDerivativeFiles,
} from "../controller/derivatives";

const router = express.Router();

router.post("/", addDerivatives);

router.get("/", getDerivatives);

router.get("/download/:fileId", getDerivativeFiles);

export default router;
