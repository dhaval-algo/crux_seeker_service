'use strict';
module.exports = (sequelize, DataTypes) => {
  const permission = sequelize.define('permission', {
    priority: DataTypes.INTEGER,
    name: DataTypes.STRING,
    permissionGroup: DataTypes.STRING,
    permissionFact: DataTypes.STRING,
    factValue: DataTypes.STRING,
    otherConditions: DataTypes.JSON
  }, {});
  permission.associate = function(models) {
    // associations can be defined here
    permission.hasMany(models.user_permission, {  foreignKey: 'permissionId' });
    permission.hasMany(models.role_has_permission, { foreignKey: 'permissionId' });
    
  };
  return permission;
};