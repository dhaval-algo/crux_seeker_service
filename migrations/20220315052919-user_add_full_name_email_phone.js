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
          type: Sequelize.STRING
        });
        await queryInterface.addColumn('users', 'email', {
          type: Sequelize.STRING
        }).
        then(() => queryInterface.addIndex('users', ['email']));
        await queryInterface.addColumn('users', 'phone', {
          type: Sequelize.STRING
        });
        await queryInterface.addColumn('users', 'profilePicture', {
          type: Sequelize.STRING
        });
        
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
      
  },

  down: (queryInterface, Sequelize) => {
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
