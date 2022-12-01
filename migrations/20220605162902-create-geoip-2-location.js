'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('geoip2_locations', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      geoname_id: {
        type:Sequelize.INTEGER,
        //allowNull: false,
        primaryKey: true
      },
      locale_code:{
        type:Sequelize.TEXT,
        //allowNull: false,
        primaryKey: true
      },
    continent_code:{
      type:Sequelize.TEXT,
      //allowNull: false,
    },
    continent_name:{
      type:Sequelize.TEXT,
      //allowNull: false,
    },
    country_iso_code:{
      type:Sequelize.TEXT,
      //allowNull: false,
    },
    country_name:{
      type:Sequelize.TEXT
    },
    subdivision_1_iso_code:{
      type:Sequelize.TEXT
    },
    subdivision_1_name:{
      type:Sequelize.TEXT
    },
    subdivision_2_iso_code:{
      type:Sequelize.TEXT
    },
    subdivision_2_name:{
      type:Sequelize.TEXT
    },
    city_name:{
      type:Sequelize.TEXT
    },
    metro_code:{
      type:Sequelize.INTEGER
    },
    time_zone:{
      type:Sequelize.TEXT
    },
    is_in_european_union:{
      type:Sequelize.BOOLEAN,
      //allowNull:false
    }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('geoip2_locations');
  }
};