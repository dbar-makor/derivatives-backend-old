import express from "express";

import { bodyKeys } from "../middleware/security";

import { login, register } from "../controller/auth";

const router = express.Router();

router.post(
  "/login",
  bodyKeys([
    { key: "username", type: "string" },
    { key: "password", type: "string" },
  ]),
  login
);

router.post(
  "/register",
  bodyKeys([
    { key: "username", type: "string" },
    { key: "password", type: "string" },
  ]),
  register
);

export default router;
