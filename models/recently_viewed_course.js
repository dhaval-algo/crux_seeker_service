'use strict';
module.exports = (sequelize, DataTypes) => {
  const recently_viewed_course = sequelize.define('recently_viewed_course', {
    courseId: DataTypes.STRING,
    userId: DataTypes.INTEGER
  }, {});
  recently_viewed_course.associate = function(models) {
    // associations can be defined here
  };
  return recently_viewed_course;
};