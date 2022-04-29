'use strict';
module.exports = (sequelize, DataTypes) => {
  const goal = sequelize.define('goal', {
    userId: DataTypes.INTEGER,
    lifeStage: DataTypes.STRING,
    currentRole: DataTypes.STRING,
    preferredRole: DataTypes.STRING,
    industryChoice: DataTypes.STRING,
    highestDegree: DataTypes.STRING,
    specialization: DataTypes.STRING,
    workExperience: DataTypes.FLOAT
  }, {});
  goal.associate = function(models) {
    // associations can be defined here
    goal.belongsTo(models.user,{ foreignKey: 'userId' });
    goal.hasMany(models.skill, { foreignKey: 'goalId' });
  };
  return goal;
};