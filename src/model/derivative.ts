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
  readonly matchedCount: number;
  readonly matchSumCharge: number;
  readonly matchedSumPercentage: number;
  readonly unmatchedCount: number;
  readonly unmatchedGroupCount: number;
  readonly unmatchedSumCharge: number;
  readonly unmatchedSumPercentage: number;
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
  public readonly matchedCount!: number;
  public readonly matchSumCharge!: number;
  public readonly matchedSumPercentage!: number;
  public readonly unmatchedCount!: number;
  public readonly unmatchedGroupCount!: number;
  public readonly unmatchedSumCharge!: number;
  public readonly unmatchedSumPercentage!: number;
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
    floorBrokerId: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    username: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    source: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    drv: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    totalCount: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    },
    totalCharge: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    },
    matchedCount: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    },
    matchSumCharge: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    },
    matchedSumPercentage: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    },
    unmatchedCount: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    },
    unmatchedGroupCount: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    },
    unmatchedSumCharge: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    },
    unmatchedSumPercentage: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
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
  },
);

export default Derivative;
