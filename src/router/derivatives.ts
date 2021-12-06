import express from "express";

import { addDerivatives, getDerivatives } from "../controller/derivatives";

const router = express.Router();

router.post("/", addDerivatives);

router.get("/", getDerivatives);

export default router;
