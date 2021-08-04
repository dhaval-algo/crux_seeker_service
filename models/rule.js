'use strict';
module.exports = (sequelize, DataTypes) => {
  const rule = sequelize.define('rule', {
    action_type: DataTypes.STRING,
    action_rule: DataTypes.JSON,
    action_reward: DataTypes.JSON,
    status: DataTypes.BOOLEAN
  }, {});
  rule.associate = function(models) {
    // associations can be defined here
  };
  return rule;
};