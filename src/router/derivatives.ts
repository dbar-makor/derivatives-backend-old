import express from "express";

import {
  addDerivativesData,
  getDerivativesData,
} from "../controller/derivatives";

const router = express.Router();

router.post("/", addDerivativesData);

router.get("/", getDerivativesData);

export default router;
