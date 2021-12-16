import express from "express";

import { IServerResponse } from "../../shared/response";

type IAuthMiddlewareResponse = express.Response<IServerResponse>;

type ILoginResponse = express.Response<
  IServerResponse & {
    data?: {
      username: string;
      token: string;
    };
  }
>;

type IRegisterResponse = express.Response<
  IServerResponse & {
    data?: {
      username: string;
      token: string;
    };
  }
>;

export { IAuthMiddlewareResponse, ILoginResponse, IRegisterResponse };
