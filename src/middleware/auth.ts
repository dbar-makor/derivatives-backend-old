import express from "express";
import jwt from "jsonwebtoken";

import ServerGlobal from "../server-global";

import User from "../model/user";

import { IAuthMiddlewareRequest } from "../model/express/request/auth";

import { IAuthMiddlewareResponse } from "../model/express/response/auth";

interface IVerify {
  readonly id: string;
  readonly iat: number;
  readonly exp: number;
}

const auth = async (
  req: IAuthMiddlewareRequest,
  res: IAuthMiddlewareResponse,
  next: express.NextFunction,
) => {
  ServerGlobal.getInstance().logger.info(
    "[auth middleware]: Start processing request",
  );

  let data: IVerify;
  let userDocument: Readonly<Omit<User, "id">> | null;
  let user_id: string;

  try {
    const token = (req.header("Authorization") as string).replace(
      "Bearer ",
      "",
    );

    data = jwt.verify(token, process.env.JWT_PWD) as IVerify;
    userDocument = await User.findByPk(data.id);

    if (!userDocument) {
      ServerGlobal.getInstance().logger.error(`
                [auth middleware]: Failed to authenticate \
because could not find user with id ${data.id}`);

      res.status(401).send({
        success: false,
        message: "Unable to authenticate",
      });
      return;
    }

    user_id = data.id;
  } catch (e: any) {
    console.log(e);
    ServerGlobal.getInstance().logger.error(
      `[auth middleware]: Failed to authenticate because of error: ${e}`,
    );

    if ((e.message = "jwt malformed")) {
      res.status(401).send({
        success: false,
        message: "Unable to authenticate",
      });
      return;
    }

    res.status(500).send({
      success: false,
      message: "Server error",
    });
    return;
  }

  ServerGlobal.getInstance().logger.info(
    `[auth middleware]: Successfully authenticated user with id ${user_id}`,
  );

  req.user_id = user_id;

  next();
};

export { auth };
