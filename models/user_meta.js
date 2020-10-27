'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_meta = sequelize.define('user_meta', {
    userId: DataTypes.INTEGER,
    key: DataTypes.STRING,
    value: DataTypes.TEXT,
    metaType: DataTypes.STRING
  }, {});
  user_meta.associate = function(models) {
    // associations can be defined here
  };
  return user_meta;
};