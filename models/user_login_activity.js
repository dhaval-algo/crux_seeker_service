'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_login_activity = sequelize.define('user_login_activity', {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      notEmpty:true,
      validate: {
        notNull:{ msg: "userTopicId cannot be null" },
        notEmpty: { msg: "userTopicId cannot be empty" }
      }
    },
    loginAt: DataTypes.DATE
  }, {});
  user_login_activity.associate = function(models) {
    // associations can be defined here
    user_login_activity.belongsTo(models.user,{ foreignKey: 'userId' });
  };
  return user_login_activity;
};