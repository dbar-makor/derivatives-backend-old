import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import ServerGlobal from "../server-global";

import User from "../model/user";

import {
  ILoginRequest,
  IAutoLoginRequest,
} from "../model/express/request/auth";
import {
  ILoginResponse,
  IAutoLoginResponse,
} from "../model/express/response/auth";

const login = async (req: ILoginRequest, res: ILoginResponse) => {
  ServerGlobal.getInstance().logger.info(
    `<login>: Start processing request with email: ${req.body.email}`
  );

  try {
    // Find matching user by email address
    const userByEmail = await User.findOne({
      where: { email: req.body.email },
    });

    // There is no such user with the provided email
    if (!userByEmail) {
      ServerGlobal.getInstance().logger.error(
        `<login>: Failed to login because the email ${req.body.email} does not match any user`
      );

      res.status(400).send({
        success: false,
        message: "Authentication failed",
      });
      return;
    }

    const compareResult = await bcrypt.compare(
      req.body.password,
      userByEmail.password
    );

    // Check whether the provided password is as same as the stored hashed one
    if (!compareResult) {
      ServerGlobal.getInstance().logger.error(
        `<login>: Failed to login because the password does not match the hashed password \
with email ${req.body.email}`
      );

      res.status(400).send({
        success: false,
        message: "Authentication failed",
      });
      return;
    }

    // Finding user token
    const tokenByUserId = await Token.findOne({
      where: { user_id: userByEmail.id },
    });

    // Create new token to insert
    let newToken = jwt.sign({ id: userByEmail.id }, process.env.JWT_PWD, {
      expiresIn: "7 days",
    });

    newToken = tokenByUserId?.token!;

    if (tokenByUserId === null) {
      ServerGlobal.getInstance().logger.error(
        `<login>: Failed to login because token is null`
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
with email: ${req.body.email} to user id: ${userByEmail.id}`
    );

    res.status(200).send({
      success: true,
      message: "Successfully authenticated",
      data: {
        username: userByEmail.username,
        email: req.body.email,
        token: newToken,
      },
    });
    return;
  } catch (e) {
    ServerGlobal.getInstance().logger.error(
      `<register>: Failed to login with email ${req.body.email} because of server error: ${e}`
    );

    res.status(500).send({
      success: false,
      message: "Server error",
    });
    return;
  }
};

const autoLogin = async (req: IAutoLoginRequest, res: IAutoLoginResponse) => {
  ServerGlobal.getInstance().logger.info(
    "<autoLogin>: Start processing request"
  );

  interface IVerify {
    readonly id: string;
    readonly iat: number;
    readonly exp: number;
  }

  let user: Pick<User, "email" | "username"> | null;
  let user_id: string;

  // Authorizing the user
  try {
    const token: string = (req.header("Authorization") as string).replace(
      "Bearer ",
      ""
    );

    const data: IVerify = jwt.verify(token, process.env.JWT_PWD) as IVerify;

    user = await User.findByPk(data.id);

    if (!user) {
      ServerGlobal.getInstance().logger.error(
        `<autoLogin>: Failed to auto login with user id of ${data.id}`
      );

      res.status(401).send({
        success: false,
        message: "Unable to auto login",
      });
      return;
    }

    user_id = data.id;
  } catch (e) {
    ServerGlobal.getInstance().logger.error(
      `<autoLogin>: Failed to auto login because of login error: ${e}`
    );

    res.status(401).send({
      success: false,
      message: "Unable to auto login",
    });
    return;
  }

  ServerGlobal.getInstance().logger.info(
    `<autoLogin>: Successfully auto login user with id ${user_id}`
  );

  res.status(200).send({
    success: true,
    message: "Successful auto login",
    data: {
      username: user.username,
      email: user.email,
    },
  });
  return;
};

export { login, autoLogin };
