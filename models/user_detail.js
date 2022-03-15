'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_detail = sequelize.define('user_detail', {
    userId: DataTypes.INTEGER,
    gender: {
      DataTypes: Sequelize.ENUM,
      values: ['MALE', 'FEMALE', 'OTHER']
    },
    dob: DataTypes.DATE,
    city: DataTypes.STRING,
    country: DataTypes.STRING,
    resume: DataTypes.STRING

  }, {});
  user_detail.associate = function(models) {
    // associations can be defined here
    user_detail.belongsTo(models.user,{ foreignKey: 'userId' });
  };
  return user_detail;
};