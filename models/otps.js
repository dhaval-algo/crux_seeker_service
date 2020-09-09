'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class otps extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  otps.init({
    username: DataTypes.STRING,
    attempts: DataTypes.INTEGER,
    otp: DataTypes.STRING,
    otpType: DataTypes.STRING,
    inValid: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'otps',
  });
  return otps;
};