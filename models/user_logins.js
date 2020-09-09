'use strict';
const {
  Model, INTEGER
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class user_logins extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      user_logins.belongsTo(models.users,{foreignKey:'userId'})
    }
  };
  user_logins.init({
    userId:DataTypes.INTEGER,
    email: DataTypes.STRING,
    phone: DataTypes.STRING,
    password: DataTypes.STRING,
    provider: DataTypes.STRING,
    providerId: DataTypes.STRING,
    providerData: DataTypes.JSON,
    loginType: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'user_logins',
  });
  return user_logins;
};