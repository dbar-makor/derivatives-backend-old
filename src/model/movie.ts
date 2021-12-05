import Sequelize, { Optional } from "sequelize";
import ServerGlobal from "../server-global";

import IDBAttribute from "./shared/db-table";

interface IMoviesAttributes extends IDBAttribute {
  readonly title: string;
  readonly description: string;
  readonly category: Category;
  readonly release_date: number;
  readonly movie_hour_length: number;
  readonly movie_minute_length: number;
  readonly image_path: string;
  readonly video_path: string;
  like_count: number;
  readonly user_id: number;
}

class Movie
  extends Sequelize.Model<
    Optional<
      IMoviesAttributes,
      "id" | "createdAt" | "updatedAt" | "like_count" | "user_id"
    >
  >
  implements IMoviesAttributes
{
  public id!: number;
  public title!: string;
  public description!: string;
  public category!: Category;
  public release_date!: number;
  public movie_hour_length!: number;
  public movie_minute_length!: number;
  public image_path!: string;
  public video_path!: string;
  public like_count!: number;
  public user_id!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Movie.init(
  {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    title: {
      type: Sequelize.STRING,
      allowNull: false,
      validate: {
        len: [3, 26],
      },
    },
    description: {
      type: Sequelize.STRING,
      allowNull: false,
      validate: {
        len: [3, 280],
      },
    },
    category: {
      type: Sequelize.ENUM,
      values: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
      allowNull: false,
    },
    release_date: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    },
    movie_hour_length: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    },
    movie_minute_length: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    },
    image_path: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    video_path: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    like_count: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    user_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    },
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  },
  {
    tableName: "movies",
    sequelize: ServerGlobal.getInstance().db,
    indexes: [
      {
        fields: ["title"],
      },
      {
        fields: ["category"],
      },
    ],
  },
);

export default Movie;
