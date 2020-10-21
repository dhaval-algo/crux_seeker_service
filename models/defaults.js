'use strict';
module.exports = (sequelize, DataTypes) => {
  const defaults = sequelize.define('defaults', {
    value: DataTypes.TEXT,
    default_type: DataTypes.STRING
  }, {});
  defaults.associate = function(models) {
    // associations can be defined here
  };
  return defaults;
};