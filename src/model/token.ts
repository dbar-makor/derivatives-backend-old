import Sequelize, { Optional } from "sequelize";
import ServerGlobal from "../server-global";

import IDBAttribute from "./shared/db-table";

interface ITokenAttributes extends IDBAttribute {
  readonly token: string;
  readonly user_id: number;
}

class Token
  extends Sequelize.Model<Optional<ITokenAttributes, "id" | "createdAt">>
  implements ITokenAttributes
{
  public id!: number;
  public token!: string;
  public user_id!: number;
  public readonly createdAt!: Date;
}

Token.init(
  {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    token: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    user_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    },
    createdAt: Sequelize.DATE,
  },
  {
    tableName: "tokens",
    sequelize: ServerGlobal.getInstance().db,
    updatedAt: false,
    indexes: [
      {
        fields: ["user_id"],
      },
    ],
  }
);

export default Token;
