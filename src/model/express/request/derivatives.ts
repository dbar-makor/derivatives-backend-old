import { IAuthenticatedRequest } from "./auth";
import express from "express";

interface IaddDerivativesRequest extends IAuthenticatedRequest {
  readonly body: Readonly<
    {
      id?: string;
      file?: string;
    }[]
  >;
}

interface IGetDerivativesRequest extends express.Request {}

interface IGetDerivativeRequest extends express.Request {}

interface IDownloadFilesRequest extends express.Request {
  readonly params: Readonly<{ fileId: string }>;
}

export {
  IaddDerivativesRequest,
  IGetDerivativesRequest,
  IGetDerivativeRequest,
  IDownloadFilesRequest,
};
