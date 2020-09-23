'use strict';
module.exports = (sequelize, DataTypes) => {
  const form_submission_values = sequelize.define('form_submission_values', {
    formSubmissionId: DataTypes.INTEGER,
    objectType: DataTypes.STRING,
    objectId: DataTypes.INTEGER
  }, {});
  form_submission_values.associate = function(models) {
    // associations can be defined here
  };
  return form_submission_values;
};