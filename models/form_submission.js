'use strict';
module.exports = (sequelize, DataTypes) => {
  const form_submission = sequelize.define('form_submission', {
    userId: DataTypes.INTEGER,
    targetEntityType: DataTypes.STRING,
    targetEntityId: DataTypes.STRING,
    formType: DataTypes.STRING,
    formTypeSource: DataTypes.STRING,
    otherInfo: DataTypes.JSON
  }, {});
  form_submission.associate = function(models) {
    // associations can be defined here
  };
  return form_submission;
};