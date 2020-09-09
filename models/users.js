'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class users extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      users.hasMany(models.user_logins, {foreignKey: 'userId'});
      users.hasMany(models.auth_tokens, {foreignKey: 'userId'});
      users.hasMany(models.roles, {through: 'user_roles', foreignKey: 'userId'});
      users.hasMany(models.permission, {through: 'user_permissions', foreignKey:'userId'})
    }
  };
  users.init({
    fullName: DataTypes.STRING,
    accountEmail: DataTypes.STRING,
    phone: DataTypes.STRING,
    picture: DataTypes.STRING,
    status: DataTypes.STRING,
    lastLogin: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'users',
  });
  return users;
};