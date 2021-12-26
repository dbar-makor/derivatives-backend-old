import Sequelize, { Optional } from "sequelize";
import ServerGlobal from "../server-global";

import IDBAttribute from "./shared/db-table";

interface IDerivativesAttributes extends IDBAttribute {
  readonly date: string;
  readonly username: string;
  readonly wex: string;
  readonly drv: string;
  readonly matched: number;
  readonly unmatched: number;
  readonly complete: number;
  readonly unresolved: string;
}

class Derivative
  extends Sequelize.Model<
    Optional<IDerivativesAttributes, "id" | "createdAt" | "username">
  >
  implements IDerivativesAttributes
{
  public readonly id!: number;
  public readonly date!: string;
  public readonly username!: string;
  public readonly wex!: string;
  public readonly drv!: string;
  public readonly matched!: number;
  public readonly unmatched!: number;
  public readonly complete!: number;
  public readonly unresolved!: string;
}

Derivative.init(
  {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    date: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    username: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    wex: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    drv: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    matched: {
      type: Sequelize.INTEGER.UNSIGNED,
    },
    unmatched: {
      type: Sequelize.INTEGER.UNSIGNED,
    },
    complete: {
      type: Sequelize.INTEGER.UNSIGNED,
    },
    unresolved: {
      type: Sequelize.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "derivatives",
    sequelize: ServerGlobal.getInstance().db,
    createdAt: false,
    updatedAt: false,
  }
);

export default Derivative;
