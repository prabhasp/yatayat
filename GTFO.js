// Rudimentary serialization of YY System based on the 
// General Transit Feed Specification Reference.

// For the benefit of node
var YY = YY || require('./yatayat.js');

var GTFO = function(system, agency) {
    // Filter by agency; agency is an object {name:, filter:, url:}
    var routes = system.routes.filter(function(r) {
        return r.transport.toLowerCase().indexOf(agency.filter) >= 0;
    });

    this.system = new YY.System(routes);
    this._agency = agency;
};

GTFO.prototype.agency = function() {
    return [{
        agency_name: this._agency.name,
        agency_url: this._agency.url,
        agency_timezone: "Asia/Kathmandu"
    }];
};

GTFO.prototype.stops = function() {
    return this.system.allStops().map(function(stop) {
        return {
            stop_id: stop.id,
            stop_name: stop.name,
            stop_lat: stop.lat,
            stop_lon: stop.lng
        };
    });
};

GTFO.prototype.routes = function() {
    return this.system.routes.map(function(route) {
        return {
            route_id: route.id,
            route_short_name: route.ref || "",
            route_long_name: route.name,
            route_type: 3    // 3 == bus
        };
    });
};

GTFO.prototype.trips = function() {
    /*
      route_id - route.id
      service_id - calendar.txt
      trip_id - autoincrement
      (opt)
      shape_id
     */

    // We'll make one trip per route, one shape per trip
    // ergo: one shape per route, one trip per trip.
    return this.system.routes.map(function(route, route_idx) {
        return {
            route_id: route.id,
            service_id: "calendar-0",
            trip_id: "trip-" + route_idx,
            shape_id: "shape-" + route_idx
        };
    });
};

GTFO.prototype.stop_times = function() {
    /*
      trip_id - 
      arrival_time - "" when nothing; must exist for 1st & last stop of trip
      departure_time - can be identical to ^ if difference not specified
      stop_id - stop.id
      stop_sequence - monotonically increasing integers

      (opt:)
      pickup_type - 0 = reg / 3 = "must coordinate with driver to arrange pickup"
      drop_off_type - same as ^
      shape_dist_traveled - in same unit as shapes.txt, dist from start
     */

    // arrival_time & departure_time will be ignored -- we'll do
    // frequencies instead

    var out = [];

    this.system.routes.forEach(function(route, route_idx) {
        var trip_id = "trip-" + route_idx;
        route.stops.forEach(function(stop, stop_idx) {
            out.push({
                trip_id: trip_id,
                arrival_time: "",
                departure_time: "",
                stop_id: stop.id,
                stop_sequence: stop_idx // XXX: are stops ordered?
            });
        });
    });

    return out;
};

GTFO.prototype.calendar = function() {
    /*
      service_id - dataset-unique, ref'ed by trips
      monday - 1 == all mondays, 0 == none
      [tues-sun] - "" ""
      start_date - YYYYMMDD
      end_date = YYYYMMDD
     */

    // XXX: Is this true?
    // TODO: incorporate wildcat strikes into calendar_dates

    return [{
        service_id: "calendar-0",
        monday: 1,
        tuesday: 1,
        wednesday: 1,
        thursday: 1,
        friday: 1,
        saturday: 1,
        sunday: 1,
        start_date: 20120701,
        end_date: 20140701
    }];
};

GTFO.prototype.shapes = function() {
    /*
      shape_id - 
      shape_pt_lat - 
      shape_pt_lon -
      shape_pt_sequence - int ordering
      (opt)
      shape_dist_traveled - see stop_times.txt
    */

    var out = [];
    this.system.routes.forEach(function(route, route_idx) {
        var shape_id = "shape-" + route_idx;
        var shape_pt_sequence = 0;
        route.segments.forEach(function(seg) {
            seg.listOfLatLng.forEach(function(ll) {
                out.push({
                    shape_id: shape_id,
                    shape_pt_lat: ll[0],
                    shape_pt_lon: ll[1],
                    shape_pt_sequence: shape_pt_sequence
                    // XXX: shape_dist_traveled
                });
                shape_pt_sequence += 1;
            });
        });
    });
    return out;
};

GTFO.prototype.frequencies = function() {
    /*
      trip_id
      start_time
      end_time
      headway_secs - time between launches
     */

    // XXX: These are a complete fabrication.

    return this.system.routes.map(function(route, route_idx) {
        return {
            trip_id: "trip-" + route_idx,
            start_time: "06:00:00",
            end_time: "21:00:00",
            headway_secs: 60*15
        };
    });
};

GTFO.prototype.FILES = ["agency", "stops", "routes", "trips", "stop_times", "calendar", "shapes", "frequencies"];

GTFO.prototype.generate_csvs = function() {
    var that = this;
    var out = {};

    this.FILES.forEach(function(name) {
        console.log("fn", name);
        out[name] = jsonToCsv(that[name]());
    });

    return out;
};

function jsonToCsv(data) {
    // data is a list of shallow objects.
    var out = "";

    var fields = [];
    for(var key in data[0]) {
        fields.push(key);
    }

    function _cn(idx,list){
        // Whether to add a trailing comma or a newline
        return idx === list.length-1 ? "\n" : ",";
    }
    function _q(str) {
        // XXX: quoting/escaping?
        // see: https://developers.google.com/transit/gtfs/reference#FileRequirements
        return str === undefined ? "" : str;
    }

    // Header
    fields.forEach(function(name, idx) {
        out += _q(name) + _cn(idx, fields);
    });

    // Payload
    data.forEach(function(row) {
        fields.forEach(function(name, idx) {
            out += _q(row[name]) + _cn(idx, fields);            
        });
    });
    return out;
};

// selectively export as a node module
var module = module || {};
module.exports = GTFO;