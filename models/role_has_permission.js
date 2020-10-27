'use strict';
module.exports = (sequelize, DataTypes) => {
  const role_has_permission = sequelize.define('role_has_permission', {
    status: DataTypes.STRING,
    roleId: DataTypes.INTEGER,
    permissionId: DataTypes.INTEGER
  }, {});
  role_has_permission.associate = function(models) {
    // associations can be defined here
  };
  return role_has_permission;
};