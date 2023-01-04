'use strict';
module.exports = (sequelize, DataTypes) => {
  const user = sequelize.define('user', {
    fullName:{
      type: DataTypes.STRING,
      allowNull: false,
      notEmpty:true,
      validate: {
        notNull:{ msg: "full name cannot be null" },
        notEmpty: { msg: "full name cannot be empty" }
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      isEmail:true,
      notEmpty:true,
      validate: {
          notNull: { msg: "email cannot be null" },
          isEmail: { msg: "email is invalid"},
          notEmpty: { msg: "email cannot be empty" }
      }
    },
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
    resumeFile: DataTypes.STRING(2048),
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
    user.hasMany(models.user_topic, { foreignKey: 'userId' });
    user.hasMany(models.user_login_activity, { foreignKey: 'userId' });    
    user.hasMany(models.goal, { foreignKey: 'userId' });
    user.hasOne(models.user_address, { foreignKey: 'userId' });
  };
  return user;
};