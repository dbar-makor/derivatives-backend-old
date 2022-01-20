import User from "../user";
import Token from "../token";

Token.belongsTo(User, {
  foreignKey: "userId",
  constraints: true,
  onDelete: "CASCADE"
});
