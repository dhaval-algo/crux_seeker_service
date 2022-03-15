'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('learnpath_enquiries', {
      id : {
        type:Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      fullName: {
        type: Sequelize.STRING,
        allowNull: false,
    },

    email : {
        type: Sequelize.STRING,
        allowNull: false,
    },

    phone : {
        type: Sequelize.STRING,
        allowNull: false,
    },

    student : {
        type:Sequelize.BOOLEAN
    },

    highestDegree : {
        type: Sequelize.STRING,
    },

    experience : {
        type: Sequelize.STRING,
    },

    enquiryMessage : {
        type: Sequelize.STRING(512),
    },
    
    learnpathName : {
        type: Sequelize.STRING,
        allowNull: false,
    },

    learnpathId : {
        type: Sequelize.STRING,
        allowNull: false,
    },

    userId : {
        type: Sequelize.INTEGER,
    },

    createdAt: {
      allowNull: false,
      type: Sequelize.DATE
    },
    
    updatedAt: {
      allowNull: false,
      type: Sequelize.DATE
    }
    }).then(() => queryInterface.addIndex('learnpath_enquiries', ['email']));
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('learnpath_enquiries');
  }
};