'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_address = sequelize.define('user_address', {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      notEmpty: true,
      validate: {
        notNull: { msg: "userId cannot be null" },
        notEmpty: { msg: "userId cannot be empty" }
      }
    },
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    addressLine: DataTypes.STRING,
    street: DataTypes.STRING,
    locality: DataTypes.STRING,
    city: DataTypes.STRING,
    state: DataTypes.STRING,
    phone: DataTypes.STRING,
    country: {
      type: DataTypes.STRING,
      allowNull: false,
      notEmpty: true,
      validate: {
        notNull: { msg: "country cannot be empty" },
        notEmpty: { msg: "country cannot be empty" }
      }
    },
    zipCode: {
      type: DataTypes.STRING,
      allowNull: false,
      notEmpty: true,
      validate: {
        notNull: { msg: "zip Code cannot be empty" },
        notEmpty: { msg: "zip Code cannot be empty" }
      }
    }
  }, {});
  user_address.associate = function (models) {
    // associations can be defined here
    user_address.belongsTo(models.user,{ foreignKey: 'userId' });
  };
  return user_address;
};
