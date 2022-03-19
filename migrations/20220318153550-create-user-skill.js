'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('user_skills', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userTopicId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'user_topics',
          key: 'id'
        },
        allowNull: false,
      },
      skill: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      isPrimary: {
        type: Sequelize.BOOLEAN
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    }).
    then(() => queryInterface.addIndex('user_skills', ['userTopicId']));
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('user_skills');
  }
};