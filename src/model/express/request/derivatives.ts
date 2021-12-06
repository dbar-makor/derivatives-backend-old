// import { IAuthenticatedRequest } from "./auth";

interface IaddDerivativesRequest {
  readonly body: Readonly<
    {
      id?: string;
      file?: string;
    }[]
  >;
}

interface IGetDerivativesRequest {}

export { IaddDerivativesRequest, IGetDerivativesRequest };
