import express from 'express';

import { auth } from '../middleware/auth';

import { bodyKeys } from '../middleware/security';

import {
    register,
    login,
    autoLogin,
    editProfile,
} from '../controller/auth';

const router = express.Router();

router.post(
    '/register',
    bodyKeys([
        { key: 'username', type: 'string' },
        { key: 'email', type: 'string' },
        { key: 'password', type: 'string' },
    ]),
    register,
);

router.post(
    '/login',
    bodyKeys([
        { key: 'email', type: 'string' },
        { key: 'password', type: 'string' },
    ]),
    login,
);

router.get(
    '/',
    autoLogin,
);

router.patch(
  "/",
  auth,
  bodyKeys([{ key: "password", type: "string" }]),
  editProfile,
);

export default router;