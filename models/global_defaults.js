'use strict';
module.exports = (sequelize, DataTypes) => {
  const global_defaults = sequelize.define('global_defaults', {
    data_type: DataTypes.STRING,
    data_value: DataTypes.STRING,
    meta_data: DataTypes.TEXT
  }, {});
  global_defaults.associate = function(models) {
    // associations can be defined here
  };
  return global_defaults;
};