'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_education = sequelize.define('user_education', {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      notEmpty:true,
      validate: {
        notNull:{ msg: "userId cannot be null" },
        notEmpty: { msg: "userId cannot be empty" }
      }
    },
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