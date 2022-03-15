'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('user_details', {
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
      gender: {
        type: Sequelize.ENUM,
        values: ['MALE', 'FEMALE', 'OTHER']
      },
      dob: {
        type: Sequelize.DATE
      },
      city: {
        type: Sequelize.STRING
      },
      country: {
        type: Sequelize.STRING
      },
      resume: {
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
    then(() => queryInterface.addIndex('user_details', ['userId']));
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('user_details');
  }
};