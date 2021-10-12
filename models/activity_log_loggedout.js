'use strict';
module.exports = (sequelize, DataTypes) => {
  const activity_log_loggedout = sequelize.define('activity_log_loggedout', {
    activityId: DataTypes.INTEGER,
    resource: DataTypes.STRING
  }, {});
  activity_log_loggedout.associate = function(models) {
    // associations can be defined here
    activity_log_loggedout.belongsTo(models.activity,{ foreignKey: 'activityId' });
  };
  return activity_log_loggedout;
};