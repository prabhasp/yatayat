var YY = YY || {};

YY.API_URL = 'http://www.overpass-api.de/api/interpreter';
YY.QUERY_STRING = '<osm-script> <union> <query type="relation"> <has-kv k="type" v="route"/> <bbox-query s="27.6839" n="27.7299" w="85.2885" e="85.3368"/> </query> <recurse type="relation-way"/> <recurse type="way-node"/> </union> <print/> </osm-script>';
YY.GET_OR_POST = 'POST';

// Alternative layerings:
// http://{s}.tile.cloudmade.com/[API-key]/997/256/
// http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
YY.TILE_SOURCE = 'http://otile1.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png';
YY.ATTRIBUTION = 'Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">';

YY.LNG = 85.3;
YY.LAT = 27.7;

// export as a node module
var module = module || {}
module.exports = YY;
