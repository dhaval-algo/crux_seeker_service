'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('user_experiences', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      jobTitle: {
        type: Sequelize.STRING
      },
      industry: {
        type: Sequelize.STRING
      },
      company: {
        type: Sequelize.STRING
      },
      currentCompany: {
        type: Sequelize.BOOLEAN
      },
      Eexperience: {
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
    }).
    then(() => queryInterface.addIndex('user_experiences', ['userId']));
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('user_experiences');
  }
};