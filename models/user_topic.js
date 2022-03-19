'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_topic = sequelize.define('user_topic', {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      notEmpty:true,
      validate: {
        notNull:{ msg: "userId cannot be null" },
        notEmpty: { msg: "userId cannot be empty" }
      }
    },
    topic: {
      type: DataTypes.STRING,
      allowNull: false,
      notEmpty:true,
      validate: {
        notNull:{ msg: "Topic cannot be null" },
        notEmpty: { msg: "Topic name cannot be empty" }
      }
    }
  }, {});
  user_topic.associate = function(models) {
    // associations can be defined here
    user_topic.belongsTo(models.user,{ foreignKey: 'userId' });
    user_topic.hasMany(models.user_skill, { foreignKey: 'userTopicId' });
  };
  return user_topic;
};