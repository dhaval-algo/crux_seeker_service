'use strict';
module.exports = (sequelize, DataTypes) => {
  const activity = sequelize.define('activity', {
    type: DataTypes.STRING
  }, {});
  activity.associate = function(models) {
    activity.hasMany(models.activity_log, { foreignKey: 'activityId' });
    activity.hasMany(models.activity_log_loggedout, { foreignKey: 'activityId' });
  };
  return activity;
};