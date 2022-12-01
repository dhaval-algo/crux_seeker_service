'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
      await queryInterface.addColumn('user_logins', 'passwordSalt', {
        type: Sequelize.STRING
      }).
      then(() => queryInterface.addIndex('user_logins', ['passwordSalt']));
  },

  down: async (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    await queryInterface.removeColumn('user_logins', 'passwordSalt');
  }
};
