'use strict';
module.exports = (sequelize, DataTypes) => {
  const activity_log = sequelize.define('activity_log', {
    userId: DataTypes.INTEGER,
    activityId: DataTypes.INTEGER,
    resource: DataTypes.STRING
  }, {});
  activity_log.associate = function(models) {
    activity_log.belongsTo(models.user,{ foreignKey: 'userId' });    
    activity_log.belongsTo(models.activity,{ foreignKey: 'activityId' });
  };
  return activity_log;
};