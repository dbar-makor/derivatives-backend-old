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
      matchedCount: number;
      matchedSumPercentage: number;
      unmatchedCount: number;
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
      matchedCount: number;
      matchSumCharge: number;
      matchedSumPercentage: number;
      unmatchedCount: number;
      unmatchedGroupCount: number;
      unmatchedSumCharge: number;
      unmatchedSumPercentage: number;
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
