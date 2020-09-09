'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class role_has__permissions extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  role_has__permissions.init({
    status: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'role_has__permissions',
  });
  return role_has__permissions;
};