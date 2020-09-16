'use strict';
module.exports = (sequelize, DataTypes) => {
  const auth_token = sequelize.define('auth_token', {
    tokenId: DataTypes.TEXT,
    userId: DataTypes.STRING,
    tokenType: DataTypes.STRING,
    inValid: DataTypes.BOOLEAN,
    validTill: DataTypes.DATE
  }, {});
  auth_token.associate = function(models) {
    // associations can be defined here
    auth_token.belongsTo(models.user,{ foreignKey: 'userId' });
  };
  return auth_token;
};