'use strict';
module.exports = (sequelize, DataTypes) => {
  const role = sequelize.define('role', {
    name: DataTypes.STRING,
    status: DataTypes.STRING
  }, {});
  role.associate = function(models) {
    // associations can be defined here
    role.hasMany(models.role_has_permission, { foreignKey: 'roleId' });

  };
  return role;
};