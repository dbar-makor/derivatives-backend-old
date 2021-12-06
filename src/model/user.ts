import Sequelize, { Optional } from "sequelize";
import ServerGlobal from "../server-global";

import IDBAttribute from "./shared/db-table";

interface IUserAttributes extends IDBAttribute {
  readonly username: string;
  readonly password: string;
}

class User
  extends Sequelize.Model<Optional<IUserAttributes, "id" | "createdAt">>
  implements IUserAttributes
{
  public readonly id!: number;
  public readonly username!: string;
  public readonly password!: string;
  public readonly createdAt!: Date;
}

User.init(
  {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    username: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    password: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    createdAt: Sequelize.DATE,
  },
  {
    tableName: "users",
    sequelize: ServerGlobal.getInstance().db,
    updatedAt: false,
  }
);

export default User;
