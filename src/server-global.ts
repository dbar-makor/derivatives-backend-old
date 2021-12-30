import path from "path";
import winston from "winston";

import { Sequelize } from "sequelize";

class ServerGlobal {
  private readonly _logger: winston.Logger;
  private readonly _db: Sequelize;
  private static _instance: ServerGlobal;

  private constructor() {
    this._logger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: path.join(__dirname, "../logs.log"),
          level: "info",
        }),
      ],
    });

    this._db = new Sequelize(
      process.env.MYSQL_SCHEMA,
      process.env.MYSQL_USERNAME,
      process.env.MYSQL_PASSWORD!,
      {
        dialect: "mysql",
        host: process.env.MYSQL_HOST,
      }
    );
  }

  /**
   * Getter for singelton instance
   * @returns ServerGlobal singelton instance
   */
  static getInstance() {
    if (this._instance) {
      return this._instance;
    }

    this._instance = new ServerGlobal();
    return this._instance;
  }

  /**
   * Getter for the logger
   * @returns logger instance
   */
  public get logger() {
    return this._logger;
  }

  /**
   * Getter for the db
   * @returns db instance
   */
  public get db() {
    return this._db;
  }
}

export default ServerGlobal;
