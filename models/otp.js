'use strict';
module.exports = (sequelize, DataTypes) => {
  const otp = sequelize.define('otp', {
    username: DataTypes.STRING,
    userId: DataTypes.INTEGER,
    attempt: DataTypes.INTEGER,
    otp:DataTypes.STRING,
    otpType: DataTypes.STRING,
    inValid: DataTypes.BOOLEAN
  }, {});
  otp.associate = function(models) {
    // associations can be defined here
  };
  return otp;
};