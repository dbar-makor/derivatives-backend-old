import express from "express";

interface IAuthMiddlewareRequest extends express.Request {
  user_id?: string;
}

interface IAdminAuthMiddlewareRequest extends express.Request {}

interface IAuthenticatedRequest extends express.Request {
  readonly user_id?: string;
}

interface ILoginRequest extends express.Request {
  readonly body: Readonly<{
    email: string;
    password: string;
  }>;
}

interface IAutoLoginRequest extends express.Request {}

export {
  IAuthMiddlewareRequest,
  IAdminAuthMiddlewareRequest,
  IAuthenticatedRequest,
  ILoginRequest,
  IAutoLoginRequest,
};
