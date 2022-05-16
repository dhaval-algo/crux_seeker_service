'use strict';
module.exports = (sequelize, DataTypes) => {
  const skill = sequelize.define('skill', {
    goalId: DataTypes.INTEGER,
    name: DataTypes.STRING
  }, {});
  skill.associate = function(models) {
    // associations can be defined here
    skill.belongsTo(models.goal,{ foreignKey: 'goalId' });
  };
  return skill;
};