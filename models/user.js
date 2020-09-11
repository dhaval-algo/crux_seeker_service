'use strict';
module.exports = (sequelize, DataTypes) => {
  const user = sequelize.define('user', {
    accountEmail: DataTypes.STRING,
    phone: DataTypes.STRING,
    fullName: DataTypes.STRING,
    picture: DataTypes.STRING,
    status: DataTypes.STRING,
    lastLogin: DataTypes.DATE
  }, {});
  user.associate = function(models) {
    // associations can be defined here
    user.hasMany(models.auth_token, { foreignKey: 'userId' });
    user.hasMany(models.user_login, { foreignKey: 'userId' });
    user.hasMany(models.user_role, { foreignKey: 'userId' });
    user.hasMany(models.user_permission, { foreignKey: 'userId' });
  };
  return user;
};