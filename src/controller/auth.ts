import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import ServerGlobal from "../server-global";

import User from "../model/user";
import Token from "../model/token";

import {
  ILoginRequest,
  IAutoLoginRequest,
} from "../model/express/request/auth";
import { ILoginResponse } from "../model/express/response/auth";

const login = async (req: ILoginRequest, res: ILoginResponse) => {
  ServerGlobal.getInstance().logger.info(
    `<login>: Start processing request with username: ${req.body.username}`,
  );

  try {
    // Find matching user by username
    const userByUsername = await User.findOne({
      where: { username: req.body.username },
    });

    // There is no such user with the provided username
    if (!userByUsername) {
      ServerGlobal.getInstance().logger.error(
        `<login>: Failed to login because the email ${req.body.username} does not match any user`,
      );

      res.status(400).send({
        success: false,
        message: "Authentication failed",
      });
      return;
    }

    if (userByUsername.password === req.body.password) {
    }

    // Finding user token
    const tokenByUserId = await Token.findOne({
      where: { user_id: userByUsername.id },
    });

    // Create new token to insert
    let newToken = jwt.sign({ id: userByUsername.id }, process.env.JWT_PWD, {
      expiresIn: "7 days",
    });

    newToken = tokenByUserId?.token!;

    // Check if token in valid
    if (!tokenByUserId) {
      ServerGlobal.getInstance().logger.error(
        `<login>: Failed to login because token is invalid`,
      );

      res.status(400).send({
        success: false,
        message: "Token error",
      });
      return;
    }

    // Saving the token document in DB
    await tokenByUserId.save();

    ServerGlobal.getInstance().logger.info(
      `<login>: Successfully logged user in \
with username: ${req.body.username} to user id: ${userByUsername.id}`,
    );

    res.status(200).send({
      success: true,
      message: "Successfully authenticated",
      data: {
        username: userByUsername.username,
        token: newToken,
      },
    });
    return;
  } catch (e) {
    ServerGlobal.getInstance().logger.error(
      `<register>: Failed to login with username ${req.body.username} because of server error: ${e}`,
    );

    res.status(500).send({
      success: false,
      message: "Server error",
    });
    return;
  }
};

export { login };
