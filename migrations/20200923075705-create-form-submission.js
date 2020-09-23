'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('form_submissions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER
      },
      targetEntityType: {
        type: Sequelize.STRING
      },
      targetEntityId: {
        type: Sequelize.STRING
      },
      formType: {
        type: Sequelize.STRING
      },
      formTypeSource: {
        type: Sequelize.STRING
      },
      otherInfo: {
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
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('form_submissions');
  }
};