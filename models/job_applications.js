'use strict';
module.exports = (sequelize, DataTypes) => {
  const job_applications = sequelize.define('job_applications', {
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    email: DataTypes.STRING,
    jobId: DataTypes.STRING,
    resume: DataTypes.STRING
  }, {});
  job_applications.associate = function(models) {
    // associations can be defined here
  };
  return job_applications;
};