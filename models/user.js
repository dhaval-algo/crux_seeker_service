'use strict';
module.exports = (sequelize, DataTypes) => {
  const user = sequelize.define('user', {
    userType:DataTypes.STRING,
    verified:DataTypes.BOOLEAN,
    phoneVerified:DataTypes.BOOLEAN,
    status: DataTypes.STRING,
    lastLogin: DataTypes.DATE
  }, {});
  user.associate = function(models) {
    // associations can be defined here
    user.hasMany(models.auth_token, { foreignKey: 'userId' });
    user.hasMany(models.user_login, { foreignKey: 'userId' });
    user.hasMany(models.user_role, { foreignKey: 'userId' });
    user.hasMany(models.user_permission, { foreignKey: 'userId' });
    user.hasMany(models.otp, { foreignKey: 'userId' });
    user.hasMany(models.activity_log, { foreignKey: 'userId' });
    user.hasMany(models.goal, { foreignKey: 'userId' });
  };
  return user;
};