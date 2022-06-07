'use strict';
module.exports = (sequelize, DataTypes) => {
  const recently_viewed_categories = sequelize.define('recently_viewed_categories', {
    userId: DataTypes.INTEGER,
    name: DataTypes.STRING,
    slug: DataTypes.STRING
  }, {});
  recently_viewed_categories.associate = function(models) {
    // associations can be defined here
  };
  return recently_viewed_categories;
};