'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
      try {
        await queryInterface.addColumn('users', 'fullName', {
          type: Sequelize.STRING,
          allowNull: false,
        });
        await queryInterface.addColumn('users', 'email', {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        }).
        then(() => queryInterface.addIndex('users', ['email']));
        
        await queryInterface.addColumn('users', 'phone', {
          type: Sequelize.STRING
        });
        await queryInterface.addColumn('users', 'gender', {
          type: Sequelize.ENUM,
          values: ['MALE', 'FEMALE', 'OTHER']
        });

        await queryInterface.addColumn('users', 'dob', {
          type: Sequelize.DATE
        });

        await queryInterface.addColumn('users', 'city', {
          type: Sequelize.STRING
        });

        await queryInterface.addColumn('users', 'country', {
          type: Sequelize.STRING
        });

        await queryInterface.addColumn('users', 'profilePicture', {
          type: Sequelize.STRING
        });

        await queryInterface.addColumn('users', 'resumeFile', {
          type: Sequelize.STRING
        });
       
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
      
  },

  down: async (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
      try {
        await queryInterface.removeColumn('users', 'fullName');
        await queryInterface.removeColumn('users', 'email');
        await queryInterface.removeColumn('users', 'phone');
        await queryInterface.removeColumn('users', 'profilePicture');
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
  }
};
