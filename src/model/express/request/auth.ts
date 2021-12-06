import express from "express";

interface IAuthMiddlewareRequest extends express.Request {
  user_id?: string;
}

interface IAuthenticatedRequest extends express.Request {
  readonly user_id?: string;
}

interface ILoginRequest extends express.Request {
  readonly body: Readonly<{
    readonly username: string;
    readonly password: string;
  }>;
}

interface IAutoLoginRequest extends express.Request {}

export {
  IAuthMiddlewareRequest,
  IAuthenticatedRequest,
  ILoginRequest,
  IAutoLoginRequest,
};
