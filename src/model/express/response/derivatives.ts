import express from "express";

import { IServerResponse } from "../../shared/response";

type IaddDerivativesResponse = express.Response<IServerResponse>;

type IGetDerivativesResponse = express.Response<
  IServerResponse & {
    data?: {
      date: string;
      wex: string;
      drv: string;
      matched: number;
      unmatched: number;
      unknown: number;
      complete: number;
      derivatives: string;
      username: string;
    }[];
  }
>;

export { IaddDerivativesResponse, IGetDerivativesResponse };
