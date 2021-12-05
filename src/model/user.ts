import Sequelize, { Optional } from "sequelize";
import ServerGlobal from "../server-global";

import IDBAttribute from "./shared/db-table";

interface IUserAttributes extends IDBAttribute {
    email: string;
    readonly username: string;
    password: string;
    like_count: number;
}
class User extends Sequelize.Model<Optional<IUserAttributes, 'id' | 'createdAt' |'updatedAt' | 'like_count'>> implements IUserAttributes {
  public id!: number;
  public email!: string;
  public username!: string;
  public password!: string;
  public like_count!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init({
  id: {
    type: Sequelize.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
    unique: true,
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      len: [3, 320],
    },
  },
  username: {
    type: Sequelize.STRING,
    allowNull: false,
    validate: {
      len: [3, 26],
    },
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false,
    validate: {
      min: 7, 
    },
  },
  like_count: {
    type: Sequelize.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
}, {
  tableName: 'movies',
  sequelize: ServerGlobal.getInstance().db,
  indexes: [{
    fields: ['title'],
  },
  {
    fields: ['category'],
  }],
});

export default User;