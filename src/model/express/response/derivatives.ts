import express from "express";

import { IServerResponse } from "../../shared/response";

type IaddDerivativesDataResponse = express.Response<
  IServerResponse & {
    data?: {
      location?: string;
      company1?: number;
      company2?: number;
      company3?: number;
    }[];
  }
>;

type IGetDerivativesDataResponse = express.Response<
  IServerResponse & {
    data?: {
      location?: string;
      company1?: number;
      company2?: number;
      company3?: number;
    }[];
  }
>;

export { IaddDerivativesDataResponse, IGetDerivativesDataResponse };
