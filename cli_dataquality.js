var YY = require('./yatayat.js');
var DQ = require('./dataquality.js');

var fs = require("fs");

var USAGE = "./cli_dataquality.js OVERPASS.xml [show_correct_routes]"

// Get "system" -- assumes that overpass XML is stored locally
if(process.argv.length < 3) {
    console.log(USAGE);
    throw "cli_dataquality requires path to XML data";
}

// Load system as YY.System
var system = YY.fromOSM(fs.readFileSync(process.argv[2], "utf-8"));

// Run tests: this will be silent if there are no errors
if(process.argv.length > 3) {
    console.log("CORRECT ROUTES");
    console.log(DQ.findCorrectRoutes(system).map(function(route) {
        return route.name + " (" + route.id + ")";
    }));
}
else {
    console.log(DQ.errorString(system));
}
