'use strict';
const models = require('../models')
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('goals', {
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
      lifeStage: {
        type: Sequelize.STRING
      },
      currentRole: {
        type: Sequelize.STRING
      },
      preferredRole: {
        type: Sequelize.STRING
      },
      industryChoice: {
        type: Sequelize.STRING
      },
      highestDegree: {
        type: Sequelize.STRING
      },
      specialization: {
        type: Sequelize.STRING
      },
      workExperience: {
        type: Sequelize.FLOAT
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
    return queryInterface.dropTable('goals');
  }
};