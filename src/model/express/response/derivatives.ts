import express from "express";

import { IServerResponse } from "../../shared/response";

type IAddDerivativesResponse = express.Response<IServerResponse>;

type IGetDerivativesResponse = express.Response<
  IServerResponse & {
    data?: {
      id: number;
      date: string;
      wex: string;
      drv: string;
      username: string;
      matchCount: number;
      matchSumPercentage: number;
      unmatchCount: number;
      unresolved: string;
    }[];
  }
>;

type IGetDerivativeResponse = express.Response<
  IServerResponse & {
    data?: {
      wex: string;
      username: string;
      totalCount: number;
      totalCharge: number;
      matchCount: number;
      matchSumCharge: number;
      matchSumPercentage: number;
      unmatchCount: number;
      unmatchGroupCount: number;
      unmatchSumCharge: number;
      unmatchSumPercentage: number;
      unresolved: string;
    };
  }
>;

type IDownloadFileResponse = express.Response;

export {
  IAddDerivativesResponse,
  IGetDerivativesResponse,
  IGetDerivativeResponse,
  IDownloadFileResponse
};
