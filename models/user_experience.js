'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_experience = sequelize.define('user_experience', {
    userId: DataTypes.INTEGER,
    jobTitle: DataTypes.STRING,
    industry: DataTypes.STRING,
    company: DataTypes.STRING,
    currentCompany: DataTypes.BOOLEAN,
    Eexperience: DataTypes.STRING
  }, {});
  user_experience.associate = function(models) {
    // associations can be defined here
    user_experience.belongsTo(models.user,{ foreignKey: 'userId' });
  };
  return user_experience;
};