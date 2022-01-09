export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly PORT: string;
      readonly HTTP_ACCESS_IP: string;
      readonly MYSQL_HOST: string;
      readonly MYSQL_PORT: string;
      readonly MYSQL_USERNAME: string;
      readonly MYSQL_SCHEMA: string;
      readonly JWT_PWD: string;
      readonly MAKOR_X_URL: string;
      readonly MAKOR_X_API_KEY: string;
    }
  }
}
