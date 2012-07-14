// For node API
var _ = _ || require("underscore");
var $ = $ || require("jquery");

var YY = YY || {}

YY.System = function(routes) {
    this.routes = routes;
};

YY.Route = function(id, stops, segments, tag, orientingSegmentID) {
    this.id = id;
    this.stops = stops;
    this.segments = segments;
    this.tag = tag;
    this.name = tag.name;
    this.orientingSegmentID = orientingSegmentID;
    this.order();
};

YY.Route.prototype.order = function() {
    var route = this;
    
    // find orienting way
    var stops = [];
    var n = 0;
    var startSegment = _.find(route.segments, function(seg) { return seg.id === route.orientingSegmentID; });
    if (!startSegment) {
        console.log('Ordering not possible for route: ', route.name, '; no orienting_way found.');
        return;
    }

    // go through it, putting all public stops in
    function recurse(thisSegment, flipped) {
        if (n === route.segments.length) return;
        n = n + 1;

        if (flipped) {
            thisSegment.listOfLatLng.reverse();
            thisSegment.orderedListofStops.reverse();
        }
        stops = stops.concat(thisSegment.orderedListofStops);
        var segmentEnd = thisSegment.listOfLatLng[ thisSegment.listOfLatLng.length - 1 ];

        var nextFwdCnxn = _.find(route.segments, function(seg) { return _.isEqual(seg.listOfLatLng[0], segmentEnd) });
        if (nextFwdCnxn) recurse(nextFwdCnxn, false);

        var nextBwdCnxn = _.find(route.segments, function(seg) { 
            return _.isEqual(seg.listOfLatLng[seg.listOfLatLng.length - 1], segmentEnd) && (seg.id !== thisSegment.id);
        });
        if (nextBwdCnxn) recurse(nextBwdCnxn, true);

        if (!nextFwdCnxn && !nextBwdCnxn) 
            console.log('Broken route found in route: ', route.name, '; only ',
                stops.length, ' stops upto', stops[stops.length-1].tag.name, ' found.');
        if (nextFwdCnxn && nextBwdCnxn) throw 'bad algorithm!';
    }
    recurse(startSegment, false);
    this.stops = _.map(stops, function(s) { return new YY.Stop(s.id, s.lat, s.lng, s.tag); });
    //DEBUG: _.each(stops, function(s) {console.log(s.tag.name)});
};

YY.Stop = function(id, lat, lng, tag) {
    this.id = id;
    this.lat = lat;
    this.lng = lng;
    this.tag = tag;
    this.name = tag.name;
};

YY.Segment = function(id, listOfLatLng, tag, orderedStops) {
    this.id = id;
    this.listOfLatLng = listOfLatLng;
    this.tag = tag;
    this.orderedListofStops = orderedStops; // intermediarily needed
};

YY.fromOSM = function (overpassXML) {
    var nodes = {};
    var segments = {};
    var routeStops = {};
    var tagToObj = function(tag) {
        tags = {};
        _.each(tag, function (t) { 
            var $t = $(t);
            tags[$t.attr('k')] = $t.attr('v'); });
        return tags; 
    };
    _.each($(overpassXML).find('node'), function(n) {
        var $n = $(n);
        var tagObj = tagToObj($n.find('tag'));
        nodes[$n.attr('id')] = {lat: $n.attr('lat'),
                                lng: $n.attr('lon'), 
                                tag: tagObj,
                                is_stop: tagObj.public_transport === 'stop_position'};
    });
    _.each($(overpassXML).find('way'), function(w) {
        $w = $(w);
        var myNodes = [];
        var myStops = [];
        _.each($w.find('nd'), function(n) {
            var node = nodes[$(n).attr('ref')];
            if(node.is_stop)
                myStops.push(node);
            myNodes.push([node.lat, node.lng]);
        });
        segments[$w.attr('id')] = new YY.Segment($w.attr('id'), myNodes, tagToObj($w.find('tag')), myStops);
    });
    routes = _.map($(overpassXML).find('relation'), function(r) {
        var $r = $(r);
        var myStops = [];
        var mySegments = [];
        var orientingSegmentID;
        _.each($r.find('member'), function(m) {
            var $m = $(m); 
            if($m.attr('type') === 'way') {
                if ($m.attr('role') === 'orienting_way')
                    orientingSegmentID = $m.attr('ref');
                mySegments.push(segments[$m.attr('ref')]);
            } else if ($m.attr('type') === 'node') {
                var n = nodes[$m.attr('ref')];
                //if($n.find('tag')public_transportation === 'stop_position') 
                if(n && n.lat && n.lng)
                    myStops.push(new YY.Stop($m.attr('ref'), n.lat, n.lng, n.tag));
            } 
        });
        return new YY.Route($r.attr('id'), myStops, mySegments, tagToObj($r.find('tag')), orientingSegmentID);
    });
    return new YY.System(routes);
}

YY.viz = function(route, map) {
route.segments.forEach(function(seg, idx) {
        var latlngs = seg.listOfLatLng.map(function(LL) {
            return new L.LatLng(LL[0], LL[1]);
        });
        //var color = 0xffffff * (idx / route.segments.length * 1.0);  
        var poly = new L.Polyline(latlngs, {color: colors.getProportional(idx / route.segments.length * 1.0)});
        map.addLayer(new L.Circle(latlngs[0], 2, {color: 'blue', opacity: 0.5}));
        map.addLayer(new L.Circle(latlngs[latlngs.length-1], 2, {color: 'green', opacity: 0.5}));
        poly.bindPopup(route.name);
        map.addLayer(poly);
    });
}

YY.render = function(route, map) {

    // draw a route on a map!

    // render the route as a multi-polyline
    var routeMPL = new L.MultiPolyline(
        _.map(route.segments, function(seg) {
            return _.map(seg.listOfLatLng, function(LL) {
                return new L.LatLng(LL[0], LL[1]);
            });
        }),
        {color: 'red'});
    routeMPL.bindPopup(route.name);
    map.addLayer(routeMPL);

    // and stops as markers
    route.stops.forEach(function(stop) {
        var latlng = new L.LatLng(stop.lat, stop.lng);
        var marker = new L.Marker(latlng);
        marker.bindPopup(stop.name);
        map.addLayer(marker);
    });
};


// COLORS MODULE
var colors = (function() {
    var colors = {};
    var colorschemes = {proportional: {
    // http://colorbrewer2.org/index.php?type=sequential
        "Set1": ["#EFEDF5", "#DADAEB", "#BCBDDC", "#9E9AC8", "#807DBA", "#6A51A3", "#54278F", "#3F007D"],
        "Set2": ["#DEEBF7", "#C6DBEF", "#9ECAE1", "#6BAED6", "#4292C6", "#2171B5", "#08519C", "#08306B"]
    }};
    var defaultColorScheme = "Set1";
    function select_from_colors(type, colorscheme, zero_to_one_inclusive) {
        var epsilon = 0.00001;
        colorscheme = colorscheme || defaultColorScheme;
        var colorsArr = colorschemes[type][colorscheme];
        return colorsArr[Math.floor(zero_to_one_inclusive * (colorsArr.length - epsilon))];
    }
  
    // METHODS FOR EXPORT
    colors.getNumProportional = function(colorscheme) {
        colorscheme = colorscheme || defaultColorScheme;
        return colorschemes.proportional[colorscheme].length;
    };
    colors.getProportional = function(zero_to_one, colorscheme) {
        return select_from_colors('proportional', colorscheme, zero_to_one);
    };
   
    return colors;
}());

// selectively export as a node module
var module = module || {}
module.exports = YY.fromOSM;

