interface IaddDerivativesDataRequest {
  readonly body: Readonly<
    {
      id?: string;
      file?: string;
    }[]
  >;
}

interface IGetDerivativesDataRequest {}

export { IaddDerivativesDataRequest, IGetDerivativesDataRequest };
