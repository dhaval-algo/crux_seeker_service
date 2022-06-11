'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_experience = sequelize.define('user_experience', {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      notEmpty:true,
      validate: {
        notNull:{ msg: "userId cannot be null" },
        notEmpty: { msg: "userId cannot be empty" }
      }
    },
    jobTitle: DataTypes.STRING,
    industry: DataTypes.STRING,
    company: DataTypes.STRING,
    currentCompany: DataTypes.BOOLEAN,
    experience: DataTypes.STRING
  }, {});
  user_experience.associate = function(models) {
    // associations can be defined here
    user_experience.belongsTo(models.user,{ foreignKey: 'userId' });
  };
  return user_experience;
};