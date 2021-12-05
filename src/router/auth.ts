import express from "express";

import { auth } from "../middleware/auth";

import { bodyKeys } from "../middleware/security";

import { login, autoLogin } from "../controller/auth";

const router = express.Router();

router.post(
  "/login",
  bodyKeys([
    { key: "email", type: "string" },
    { key: "password", type: "string" },
  ]),
  login,
);

router.get("/", autoLogin);

export default router;
