import express from "express";

import { IServerResponse } from "../../shared/response";

type IAuthMiddlewareResponse = express.Response<IServerResponse>;

type IAdminAuthMiddlewareResponse = express.Response<IServerResponse>;

type IRegisterResponse = express.Response<
  IServerResponse & {
    data?: {
      username: string;
      email: string;
      token: string;
    };
  }
>;

type ILoginResponse = express.Response<
  IServerResponse & {
    data?: {
      username: string;
      email: string;
      token: string;
    };
  }
>;

type IAutoLoginResponse = express.Response<
  IServerResponse & {
    data?: {
      username: string;
      email: string;
    };
  }
>;

type IEditProfileResponse = express.Response<IServerResponse>;

export {
  IAuthMiddlewareResponse,
  IAdminAuthMiddlewareResponse,
  IRegisterResponse,
  ILoginResponse,
  IAutoLoginResponse,
  IEditProfileResponse,
};
