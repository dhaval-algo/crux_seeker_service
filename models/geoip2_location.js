'use strict';
module.exports = (sequelize, DataTypes) => {
  const geoip2_location = sequelize.define('geoip2_location', {
    geoname_id: {
      type:DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    locale_code:{
      type:DataTypes.TEXT,
      //allowNull: false,
      primaryKey: true
    },
  continent_code:{
    type:DataTypes.TEXT,
    //allowNull: false,
  },
  continent_name:{
    type:DataTypes.TEXT,
    //allowNull: false,
  },
  country_iso_code:{
    type:DataTypes.TEXT,
    //allowNull: false,
  },
  country_name:{
    type:DataTypes.TEXT
  },
  subdivision_1_iso_code:{
    type:DataTypes.TEXT
  },
  subdivision_1_name:{
    type:DataTypes.TEXT
  },
  subdivision_2_iso_code:{
    type:DataTypes.TEXT
  },
  subdivision_2_name:{
    type:DataTypes.TEXT
  },
  city_name:{
    type:DataTypes.TEXT
  },
  metro_code:{
    type:DataTypes.INTEGER
  },
  time_zone:{
    type:DataTypes.TEXT
  },
  is_in_european_union:{
    type:DataTypes.BOOLEAN,
    //allowNull:false
  }
  }, {});
  geoip2_location.associate = function(models) {
    // associations can be defined here
  };
  return geoip2_location;
};