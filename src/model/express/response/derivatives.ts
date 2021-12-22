import express from "express";

import { IServerResponse } from "../../shared/response";

type IaddDerivativesResponse = express.Response<IServerResponse>;

type IGetDerivativesResponse = express.Response<
  IServerResponse & {
    data?: {
      id: number;
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

type IGetDerivativeResponse = express.Response<
  IServerResponse & {
    data?: {
      id: number;
      date: string;
      wex: string;
      drv: string;
      matched: number;
      unmatched: number;
      unknown: number;
      complete: number;
      derivatives: string;
      username: string;
    };
  }
>;

export {
  IaddDerivativesResponse,
  IGetDerivativesResponse,
  IGetDerivativeResponse,
};
