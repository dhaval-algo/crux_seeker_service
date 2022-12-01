'use strict';
module.exports = (sequelize, DataTypes) => {
  const geoip2_network = sequelize.define('geoip2_network', {
    network: {
      type:DataTypes.CIDR,
      allowNull: false,
    },
    geoname_id: DataTypes.INTEGER,
    registered_country_geoname_id: DataTypes.INTEGER,
    represented_country_geoname_id: DataTypes.INTEGER,
    is_anonymous_proxy: DataTypes.BOOLEAN,
    is_satellite_provider: DataTypes.BOOLEAN,
    postal_code: DataTypes.TEXT,
    latitude: DataTypes.NUMERIC,
    longitude: DataTypes.NUMERIC,
    accuracy_radius: DataTypes.INTEGER

  }, {});
  geoip2_network.associate = function(models) {
    // associations can be defined here
  };
  return geoip2_network;
};