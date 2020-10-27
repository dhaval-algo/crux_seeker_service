'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_permission = sequelize.define('user_permission', {
    userId: DataTypes.INTEGER,
    peermissionId: DataTypes.INTEGER,
    status: DataTypes.STRING,
    conditionValues: DataTypes.JSON,
    validTill: DataTypes.DATE
  }, {});
  user_permission.associate = function(models) {
    // associations can be defined here
    user_permission.belongsTo(models.permission, { foreignKey: 'permissionId' });
    user_permission.belongsTo(models.user, { foreignKey: 'userId' });
  };
  return user_permission;
};