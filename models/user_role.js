'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_role = sequelize.define('user_role', {
    status: DataTypes.STRING,
    userId: DataTypes.INTEGER,
    roleId: DataTypes.INTEGER
  }, {});
  user_role.associate = function(models) {
    // associations can be defined here
    user_role.belongsTo(models.role, {foreingKey:'roleId'})
    user_role.belongsTo(models.user, {foreingKey:'userId'})
  };
  return user_role;
};