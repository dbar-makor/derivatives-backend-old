import express from 'express';
import jwt from 'jsonwebtoken';

import ServerGlobal from '../server-global';

import User from '../model/user';

import { 
    IAuthMiddlewareRequest,
    IAdminAuthMiddlewareRequest,
} from '../model/express/request/auth';

import { 
    IAuthMiddlewareResponse,
    IAdminAuthMiddlewareResponse,
} from '../model/express/response/auth';

interface IVerify {
    readonly id: string;
    readonly iat: number;
    readonly exp: number;
}

const auth = async (req: IAuthMiddlewareRequest, res: IAuthMiddlewareResponse, next: express.NextFunction) => {
    ServerGlobal.getInstance().logger.info('[auth middleware]: Start processing request');

    let data: IVerify;
    let userDocument: Readonly<Omit<User, 'id'>> | null;
    let user_id: string;

    try {
        const token = (req.header('Authorization') as string).replace('Bearer ', '');

        data = jwt.verify(token, process.env.JWT_PWD) as IVerify;
        userDocument = await User.findByPk(data.id);

        if (!userDocument) {
            ServerGlobal.getInstance().logger.error(`
                [auth middleware]: Failed to authenticate \
because could not find user with id ${data.id}`
            );

            res.status(401).send({
                success: false,
                message: 'Unable to authenticate'
            });
            return;
        }

        user_id = data.id;
    } catch (e: any) {
        ServerGlobal.getInstance().logger.error(
            `[auth middleware]: Failed to authenticate because of error: ${e}`
        );

        if (e.message = 'jwt malformed') {
            res.status(401).send({
                success: false,
                message: 'Unable to authenticate'
            });
            return;
        }

        res.status(500).send({
            success: false,
            message: 'Server error',
        });
        return;
    }

    ServerGlobal.getInstance().logger.info(
        `[auth middleware]: Successfully authenticated user with id ${user_id}`
    );

    req.user_id = user_id;

    next();
}

const adminAuth = async (req: IAdminAuthMiddlewareRequest, res: IAdminAuthMiddlewareResponse, next: express.NextFunction) => {
    ServerGlobal.getInstance().logger.info('[admin auth middleware]: Start processing request');

    try {
        const token = (req.header('Authorization') as string).replace('Bearer ', '');

        const data = jwt.verify(token, process.env.JWT_PWD) as IVerify;

        const adminDocument = await User.findByPk(data.id);

        if (!adminDocument || adminDocument.email !== process.env.ADMIN_EMAIL) {
            ServerGlobal.getInstance().logger.error(
                `[admin auth middleware]: Failed to authenticate administrator for id: ${data.id}`
            );

            res.status(401).send({
                success: false,
                message: 'Unable to authenticate'
            });
            return;
        }

        ServerGlobal.getInstance().logger.info(
            `[admin auth middleware]: Successfully authenticated administrator with id ${data.id}`
        );

        next();
    } catch (e: any) {
        ServerGlobal.getInstance().logger.error(
            `[admin auth middleware]: Failed to authenticate administrator because of error: ${e}`
        );

        if (e.message = 'jwt malformed') {
            res.status(401).send({
                success: false,
                message: 'Unable to authenticate'
            });
            return;
        }

        res.status(500).send({
            success: false,
            message: 'Server error',
        });
        return;
    }
}

export { 
    auth,
    adminAuth,
}