'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('geoip2_networks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      network: {
        type: Sequelize.CIDR
      },
      geoname_id: Sequelize.INTEGER,
      registered_country_geoname_id: Sequelize.INTEGER,
      represented_country_geoname_id: Sequelize.INTEGER,
      is_anonymous_proxy: Sequelize.BOOLEAN,
      is_satellite_provider: Sequelize.BOOLEAN,
      postal_code: Sequelize.TEXT,
      latitude: Sequelize.NUMERIC,
      longitude: Sequelize.NUMERIC,
      accuracy_radius: Sequelize.INTEGER
    }).then(() => queryInterface.addIndex('geoip2_networks', ['network'], {operator: "inet_ops"}));
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('geoip2_networks');
  }
};