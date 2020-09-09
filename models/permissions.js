'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class permissions extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      permissions.belongsToMany(models.users, {
        through:'user_permissions',
        foreignKey:'permissionId'
      })
      permissions.belongsToMany(models.roles, {
        through:'role_has_permissions',
        foreignKey:'permissionId'
      })
    }
  };
  permissions.init({
    priority: DataTypes.INTEGER,
    name: DataTypes.STRING,
    permissionGroup: DataTypes.STRING,
    permissionFact: DataTypes.STRING,
    factValue: DataTypes.STRING,
    accessType: DataTypes.STRING,
    otherConditions: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'permissions',
  });
  return permissions;
};