'use strict';
module.exports = (sequelize, DataTypes) => {
  const popular_categories = sequelize.define('popular_categories', {
    name: DataTypes.STRING,
    count: DataTypes.INTEGER
  }, {});
  popular_categories.associate = function(models) {
    // associations can be defined here
  };
  return popular_categories;
};