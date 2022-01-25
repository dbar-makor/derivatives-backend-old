import Sequelize, { Optional } from "sequelize";
import ServerGlobal from "../server-global";

import IDBAttribute from "./shared/db-table";

interface IDerivativesAttributes extends IDBAttribute {
  readonly date: string;
  readonly floorBrokerId: string;
  readonly username: string;
  readonly source: string;
  readonly drv: string;
  readonly totalCount: number;
  readonly totalCharge: number;
  readonly matchCount: number;
  readonly matchSumCharge: number;
  readonly matchSumPercentage: number;
  readonly unmatchCount: number;
  readonly unmatchGroupCount: number;
  readonly unmatchSumCharge: number;
  readonly unmatchSumPercentage: number;
  readonly unresolved: string;
}

class Derivative
  extends Sequelize.Model<Optional<IDerivativesAttributes, "id">>
  implements IDerivativesAttributes
{
  public readonly id!: number;
  public readonly date!: string;
  public readonly floorBrokerId!: string;
  public readonly username!: string;
  public readonly source!: string;
  public readonly drv!: string;
  public readonly totalCount!: number;
  public readonly totalCharge!: number;
  public readonly matchCount!: number;
  public readonly matchSumCharge!: number;
  public readonly matchSumPercentage!: number;
  public readonly unmatchCount!: number;
  public readonly unmatchGroupCount!: number;
  public readonly unmatchSumCharge!: number;
  public readonly unmatchSumPercentage!: number;
  public readonly unresolved!: string;
}

Derivative.init(
  {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true
    },
    date: {
      type: Sequelize.STRING,
      allowNull: false
    },
    floorBrokerId: {
      type: Sequelize.STRING,
      allowNull: false
    },
    username: {
      type: Sequelize.STRING,
      allowNull: false
    },
    source: {
      type: Sequelize.STRING,
      allowNull: false
    },
    drv: {
      type: Sequelize.STRING,
      allowNull: false
    },
    totalCount: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false
    },
    totalCharge: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    matchCount: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false
    },
    matchSumCharge: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    matchSumPercentage: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    unmatchCount: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false
    },
    unmatchGroupCount: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false
    },
    unmatchSumCharge: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    unmatchSumPercentage: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    unresolved: {
      type: Sequelize.STRING,
      allowNull: false
    }
  },
  {
    tableName: "derivatives",
    sequelize: ServerGlobal.getInstance().db,
    createdAt: false,
    updatedAt: false
  }
);

export default Derivative;
