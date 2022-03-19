'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('user_educations', {
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
        },
        allowNull: false,
      },
      instituteName: {
        type: Sequelize.STRING
      },
      degree: {
        type: Sequelize.STRING
      },
      degree: {
        type: Sequelize.STRING
      },
      specialization: {
        type: Sequelize.STRING
      },
      graduationYear: {
        type: Sequelize.STRING
      },
      gradeType: {
        type: Sequelize.STRING
      },
      grade: {
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
    then(() => queryInterface.addIndex('user_educations', ['userId']));
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('user_educations');
  }
};