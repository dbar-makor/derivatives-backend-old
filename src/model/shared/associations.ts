import Movie from '../movie';
import User from '../user';
import FavoriteMovies from '../favoriteMovies';
import Token from '../token';

Movie.belongsToMany(User, {
  through: {
    model: FavoriteMovies,
    unique: false,
  },
  foreignKey: 'movie_id',
  constraints: true,
  onDelete: 'CASCADE',
});

Movie.belongsTo(User, {
  foreignKey: 'user_id',
  constraints: true,
  onDelete: 'CASCADE',
});

User.belongsToMany(Movie, {
  through: {
    model: FavoriteMovies,
    unique: false,
  },
  foreignKey: 'user_id',
  constraints: true,
  onDelete: 'CASCADE',
});

Token.belongsTo(User, {
  foreignKey: 'user_id',
  constraints: true,
  onDelete: 'CASCADE',
});