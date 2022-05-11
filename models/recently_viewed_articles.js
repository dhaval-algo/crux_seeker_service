'use strict';
module.exports = (sequelize, DataTypes) => {
  const recently_viewed_articles = sequelize.define('recently_viewed_articles', {
    articleId: DataTypes.STRING,
    userId: DataTypes.INTEGER
  }, {});
  recently_viewed_articles.associate = function(models) {
    // associations can be defined here
  };
  return recently_viewed_articles;
};