'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('activity_logs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER
      },
      activityId: {
        type: Sequelize.INTEGER
      },
      resource: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    }).then(() => queryInterface.addIndex('activity_logs', ['userId','activityId','resource','createdAt']))
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('activity_logs');
  }
};