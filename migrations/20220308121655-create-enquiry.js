'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('enquiries', {
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
        allowNull: false
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
    
    courseName : {
        type: Sequelize.STRING,
        allowNull: false,
    },

    courseId : {
        type: Sequelize.STRING,
        allowNull: false,
    },

    userId : {
        type: Sequelize.INTEGER,
    },
    
    partnerId : {
      type: Sequelize.INTEGER,
      allowNull: false,

    },

    createdAt: {
      allowNull: false,
      type: Sequelize.DATE
    },
    
    updatedAt: {
      allowNull: false,
      type: Sequelize.DATE
    }
      
    }).then(() => queryInterface.addIndex('enquiries', ['email','partnerId']));
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('enquiries');
  }
};