'use strict';
module.exports = (sequelize, DataTypes) => {
  const popular_skills = sequelize.define('popular_skills', {
    name: DataTypes.STRING,
    count: DataTypes.INTEGER
  }, {});
  popular_skills.associate = function(models) {
    // associations can be defined here
  };
  return popular_skills;
};