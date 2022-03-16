'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_skill = sequelize.define('user_skill', {
    userId: DataTypes.INTEGER,
    name: DataTypes.STRING,
    isPrimary: DataTypes.BOOLEAN
  }, {});
  user_skill.associate = function(models) {
    // associations can be defined here
    user_skill.belongsTo(models.user,{ foreignKey: 'userId' });
  };
  return user_skill;
};