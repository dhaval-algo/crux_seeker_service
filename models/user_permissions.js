'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class user_permissions extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  user_permissions.init({
    status: DataTypes.STRING,
    conditionValues: DataTypes.JSON,
    validTill: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'user_permissions',
  });
  return user_permissions;
};