import User from "../user";
import Token from "../token";

Token.belongsTo(User, {
  foreignKey: "user_id",
  constraints: true,
  onDelete: "CASCADE",
});
