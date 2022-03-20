'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_login = sequelize.define('user_login', {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      notEmpty:true,
      validate: {
        notNull:{ msg: "userId cannot be null" },
        notEmpty: { msg: "userId cannot be empty" }
      }
    },    
    password: DataTypes.STRING,
    passwordSalt: DataTypes.STRING,
    provider: DataTypes.STRING,
    providerId: DataTypes.STRING,
    providerData: DataTypes.JSON,
    loginType: DataTypes.STRING
  }, {});
  user_login.associate = function(models) {
    // associations can be defined here
    user_login.belongsTo(models.user,{ foreignKey: 'userId' });
  };
  return user_login;
};