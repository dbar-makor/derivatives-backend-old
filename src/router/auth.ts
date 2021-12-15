import express from "express";

import { auth } from "../middleware/auth";

import { bodyKeys } from "../middleware/security";

import { login } from "../controller/auth";

const router = express.Router();

router.post(
  "/login",
  bodyKeys([
    { key: "username", type: "string" },
    { key: "password", type: "string" },
  ]),
  login,
);

export default router;
