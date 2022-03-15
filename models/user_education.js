'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_education = sequelize.define('user_education', {
    userId: DataTypes.INTEGER,
    instituteName: DataTypes.STRING,
    degree: DataTypes.STRING,
    degree: DataTypes.STRING,
    specialization: DataTypes.STRING,
    graduationYear: DataTypes.STRING,
    gradeType: DataTypes.STRING,
    grade: DataTypes.STRING
  }, {});
  user_education.associate = function(models) {
    // associations can be defined here
    user_education.belongsTo(models.user,{ foreignKey: 'userId' });
  };
  return user_education;
};