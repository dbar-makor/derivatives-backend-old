import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import ServerGlobal from "../server-global";

import User from "../model/user";
import Token from "../model/token";

import { ILoginRequest, IRegisterRequest } from "../model/express/request/auth";
import {
  ILoginResponse,
  IRegisterResponse,
} from "../model/express/response/auth";

const register = async (req: IRegisterRequest, res: IRegisterResponse) => {
  try {
    // From now on, the client is allowed to register
    const hashedPassword = await bcrypt.hash(req.body.password, 8);

    // Saving the user document in DB
    const newUser = await User.create({
      username: req.body.username,
      password: hashedPassword,
    });

    // Creating the user document
    const newToken = jwt.sign({ id: newUser.id }, process.env.JWT_PWD, {
      expiresIn: "7 days",
    });

    await Token.create({
      token: newToken,
      user_id: newUser.id,
    });

    ServerGlobal.getInstance().logger.info(
      `<register>: Successfully registered user with ID: ${newUser.id}`,
    );

    res.status(201).send({
      success: true,
      message: "Successfully created a new user",
      data: {
        username: req.body.username,
        token: newToken,
      },
    });
    return;
  } catch (e) {
    ServerGlobal.getInstance().logger.error(
      `<register>: Failed to register because of server error: ${e}`,
    );

    res.status(500).send({
      success: false,
      message: "Server error",
    });
    return;
  }
};

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
        `<login>: Failed to login because the username ${req.body.username} does not match any user`,
      );

      res.status(400).send({
        success: false,
        message: "Authentication failed",
      });
      return;
    }

    const compareResult = await bcrypt.compare(
      req.body.password,
      userByUsername.password,
    );

    // Check whether the provided password is as same as the stored hashed one
    if (!compareResult) {
      ServerGlobal.getInstance().logger.error(
        `<login>: Failed to login because the password does not match the hashed password \
with username ${req.body.username}`,
      );

      res.status(400).send({
        success: false,
        message: "Authentication failed",
      });
      return;
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

export { login, register };
