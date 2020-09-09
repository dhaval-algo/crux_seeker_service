'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class auth_tokens extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  auth_tokens.init({
    tokenId: DataTypes.STRING,
    tokenType: DataTypes.STRING,
    inValid: DataTypes.BOOLEAN,
    additionalData: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'auth_tokens',
  });
  return auth_tokens;
};