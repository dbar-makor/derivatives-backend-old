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

type IAutoLoginResponse = express.Response<
  IServerResponse & {
    data?: {
      username: string;
    };
  }
>;

export { IAuthMiddlewareResponse, ILoginResponse, IAutoLoginResponse };
