import { IAuthenticatedRequest } from "./auth";
import express from "express";

interface IAddDerivativesRequest extends IAuthenticatedRequest {
  readonly body: Readonly<{
    files: ReadonlyArray<{
      id?: string;
      name?: string;
      file?: string;
    }>;
    floorBrokerId: string;
  }>;
}

interface IGetDerivativesRequest extends express.Request {}

interface IGetDerivativeRequest extends express.Request {}

interface IDownloadFilesRequest extends express.Request {
  readonly params: Readonly<{ fileId: string }>;
}

export {
  IAddDerivativesRequest,
  IGetDerivativesRequest,
  IGetDerivativeRequest,
  IDownloadFilesRequest,
};
