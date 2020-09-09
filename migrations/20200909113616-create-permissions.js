'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('permissions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      priority: {
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      permissionGroup: {
        type: Sequelize.STRING
      },
      permissionFact: {
        type: Sequelize.STRING
      },
      factValue: {
        type: Sequelize.STRING
      },
      accessType: {
        type: Sequelize.STRING
      },
      otherConditions: {
        type: Sequelize.JSON
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('permissions');
  }
};