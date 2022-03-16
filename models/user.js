'use strict';
module.exports = (sequelize, DataTypes) => {
  const user = sequelize.define('user', {
    fullName: DataTypes.STRING,
    email: DataTypes.STRING,
    phone: DataTypes.STRING,
    verified: DataTypes.BOOLEAN,
    phoneVerified: DataTypes.BOOLEAN,
    status: DataTypes.STRING,
    userType: DataTypes.STRING,
    gender: {
      type: DataTypes.ENUM,
      values: ['MALE', 'FEMALE', 'OTHER']
    },
    dob: DataTypes.DATE,
    city: DataTypes.STRING,
    country: DataTypes.STRING,
    resumeFile: DataTypes.STRING,
    profilePicture: DataTypes.STRING

  }, {});
  user.associate = function(models) {
    // associations can be defined here
    user.hasMany(models.auth_token, { foreignKey: 'userId' });
    user.hasMany(models.user_login, { foreignKey: 'userId' });
    user.hasMany(models.user_role, { foreignKey: 'userId' });
    user.hasMany(models.user_permission, { foreignKey: 'userId' });
    user.hasMany(models.otp, { foreignKey: 'userId' });
    user.hasMany(models.activity_log, { foreignKey: 'userId' });
    user.hasMany(models.user_education, { foreignKey: 'userId' });
    user.hasMany(models.user_experience, { foreignKey: 'userId' });
    user.hasMany(models.user_skill, { foreignKey: 'userId' });
    
  };
  return user;
};