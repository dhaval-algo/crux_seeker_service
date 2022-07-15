'use strict';
module.exports = (sequelize, DataTypes) => {
  const popular_topics = sequelize.define('popular_topics', {
    name: DataTypes.STRING,
    count: DataTypes.INTEGER
  }, {});
  popular_topics.associate = function(models) {
    // associations can be defined here
  };
  return popular_topics;
};