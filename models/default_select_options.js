'use strict';
module.exports = (sequelize, DataTypes) => {
  const default_options = sequelize.define('default_select_options', {
    label: DataTypes.STRING,
    value: DataTypes.STRING,
    slug: DataTypes.STRING,
    optionType: DataTypes.STRING
  }, {});
  default_options.associate = function(models) {
    // associations can be defined here
  };
  return default_options;
};