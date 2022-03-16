'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_login_activity = sequelize.define('user_login_activity', {
    userId: DataTypes.INTEGER,
    loginAt: DataTypes.DATE
  }, {});
  user_login_activity.associate = function(models) {
    // associations can be defined here
    user_login_activity.belongsTo(models.user,{ foreignKey: 'userId' });
  };
  return user_login_activity;
};