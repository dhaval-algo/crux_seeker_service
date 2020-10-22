'use strict';
module.exports = (sequelize, DataTypes) => {
  const global_defaults = sequelize.define('global_defaults', {
    dataType: DataTypes.STRING,
    dataValue: DataTypes.STRING,
    metaData: DataTypes.TEXT
  }, {});
  global_defaults.associate = function(models) {
    // associations can be defined here
  };
  return global_defaults;
};