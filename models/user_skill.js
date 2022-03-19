'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_skill = sequelize.define('user_skill', {
    userTopicId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      notEmpty:true,
      validate: {
        notNull:{ msg: "userTopicId cannot be null" },
        notEmpty: { msg: "userTopicId cannot be empty" }
      }
    },
    skill: {
      type: DataTypes.STRING,
      allowNull: false,
      notEmpty:true,
      validate: {
        notNull:{ msg: "skill cannot be null" },
        notEmpty: { msg: "skill name cannot be empty" }
      }
    },
    isPrimary: DataTypes.BOOLEAN
  }, {});
  user_skill.associate = function(models) {
    // associations can be defined here
    user_skill.belongsTo(models.user_topic,{ foreignKey: 'userTopicId' });
  };
  return user_skill;
};