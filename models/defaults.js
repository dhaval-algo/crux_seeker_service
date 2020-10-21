'use strict';
module.exports = (sequelize, DataTypes) => {
  const defaults = sequelize.define('defaults', {
    dataValue: DataTypes.TEXT,
    dataType: DataTypes.STRING
  }, {});
  defaults.associate = function(models) {
    // associations can be defined here
  };
  return defaults;
};