import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import ServerGlobal from "../server-global";

import User from "../model/user";
import Token from "../model/token";

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
    `<login>: Start processing request with username: ${req.body.username}`
  );

  try {
    // Find matching user by username
    const userByusername = await User.findOne({
      where: { username: req.body.username },
    });

    // There is no such user with the provided username
    if (!userByusername) {
      ServerGlobal.getInstance().logger.error(
        `<login>: Failed to login because the email ${req.body.username} does not match any user`
      );

      res.status(400).send({
        success: false,
        message: "Authentication failed",
      });
      return;
    }

    // const compareResult = await bcrypt.compare(
    //   req.body.password,
    //   userByusername.password
    // );

    // // From now on, the client is allowed to register
    // const hashedPassword = await bcrypt.hash(req.body.password, 8);

    // Check whether the provided password is as same as the stored hashed one
    //     if (!compareResult) {
    //       ServerGlobal.getInstance().logger.error(
    //         `<login>: Failed to login because the password does not match the hashed password \
    // with username ${req.body.username}`
    //       );

    //       res.status(400).send({
    //         success: false,
    //         message: "Authentication failed",
    //       });
    //       return;
    //     }

    // Finding user token

    const tokenByUserId = await Token.findOne({
      where: { user_id: userByusername.id },
    });

    // Create new token to insert
    let newToken = jwt.sign({ id: userByusername.id }, process.env.JWT_PWD, {
      expiresIn: "7 days",
    });

    newToken = tokenByUserId?.token!;

    // // Saving the user document in DB
    // await User.create({
    //   username: req.body.username,
    //   password: req.body.password,
    // });

    // Check if token in valid
    if (!tokenByUserId) {
      ServerGlobal.getInstance().logger.error(
        `<login>: Failed to login because token is invalid`
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
with username: ${req.body.username} to user id: ${userByusername.id}`
    );

    res.status(200).send({
      success: true,
      message: "Successfully authenticated",
      data: {
        username: userByusername.username,
        token: newToken,
      },
    });
    return;
  } catch (e) {
    ServerGlobal.getInstance().logger.error(
      `<register>: Failed to login with username ${req.body.username} because of server error: ${e}`
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

  let user: Pick<User, "username"> | null;
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
    },
  });
  return;
};

export { login, autoLogin };
